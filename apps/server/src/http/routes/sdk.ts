/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * SDK Routes - REST API for @browseros/agent-sdk
 * Uses MCP client for browser operations, LLM client for AI operations.
 */

import { EXTERNAL_URLS } from '@browseros/shared/constants/urls'
import {
  LLM_PROVIDERS,
  type LLMConfig,
  LLMConfigSchema,
} from '@browseros/shared/schemas/llm'
import type { ModelMessage } from 'ai'
import { Hono } from 'hono'
import { z } from 'zod'
import { LLMClient } from '../../agent/llm/client.js'
import type { Logger } from '../../common/index.js'
import type { Env } from '../types.js'
import {
  callMcpTool,
  getImageContent,
  getTextContent,
} from '../utils/mcp-client.js'
import { validateRequest } from '../utils/validation.js'

// Request schemas
const NavRequestSchema = z.object({
  url: z.string().url(),
  tabId: z.number().optional(),
  windowId: z.number().optional(),
})

const ActRequestSchema = z.object({
  instruction: z.string().min(1),
  context: z.record(z.unknown()).optional(),
  maxSteps: z.number().optional(),
  windowId: z.number().optional(),
  llm: LLMConfigSchema.optional(),
})

const ExtractRequestSchema = z.object({
  instruction: z.string().min(1),
  schema: z.record(z.unknown()),
  context: z.record(z.unknown()).optional(),
})

const VerifyRequestSchema = z.object({
  expectation: z.string().min(1),
  context: z.record(z.unknown()).optional(),
  llm: LLMConfigSchema.optional(),
})

interface SdkRouteDeps {
  port: number
  logger: Logger
  browserosId?: string
}

interface ActiveTabResult {
  tabId: number
  url: string
  title: string
  windowId: number
}

interface PageContentResult {
  content?: string
}

export function createSdkRoutes(deps: SdkRouteDeps) {
  const { port, logger, browserosId } = deps

  const mcpServerUrl = `http://127.0.0.1:${port}/mcp`

  const sdk = new Hono<Env>()

  // POST /sdk/nav - Navigate to a URL
  sdk.post('/nav', validateRequest(NavRequestSchema), async (c) => {
    const { url, tabId, windowId } = c.get('validatedBody') as z.infer<
      typeof NavRequestSchema
    >

    logger.info('SDK nav request', { url, tabId, windowId })

    try {
      const result = await callMcpTool(mcpServerUrl, 'browser_navigate', {
        url,
        ...(tabId && { tabId }),
        ...(windowId && { windowId }),
      })

      if (result.isError) {
        return c.json({ error: { message: getTextContent(result) } }, 500)
      }

      return c.json({ success: true })
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Navigation failed'
      logger.error('SDK nav error', { url, error: message })
      return c.json({ error: { message } }, 500)
    }
  })

  // POST /sdk/act - Execute an instruction using the agent loop
  // Calls the /chat endpoint internally to reuse agent infrastructure
  sdk.post('/act', validateRequest(ActRequestSchema), async (c) => {
    const { instruction, context, maxSteps, windowId, llm } = c.get(
      'validatedBody',
    ) as z.infer<typeof ActRequestSchema>

    logger.info('SDK act request', { instruction, maxSteps, windowId })

    // Resolve LLM config: use provided config or default to BROWSEROS
    const resolvedLlm = llm ?? { provider: LLM_PROVIDERS.BROWSEROS }

    // BROWSEROS provider gets model from config, others require explicit model
    if (
      resolvedLlm.provider !== LLM_PROVIDERS.BROWSEROS &&
      !resolvedLlm.model
    ) {
      return c.json(
        { error: { message: 'model is required for non-browseros providers' } },
        400,
      )
    }

    try {
      // Build message with context if provided
      let message = instruction
      if (context) {
        message = `${instruction}\n\nContext:\n${JSON.stringify(context, null, 2)}`
      }

      // Create a unique conversation ID for this request
      const conversationId = crypto.randomUUID()

      // Call the chat endpoint internally
      const chatUrl = `http://127.0.0.1:${port}/chat`
      const response = await fetch(chatUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId,
          message,
          provider: resolvedLlm.provider,
          model: resolvedLlm.model ?? 'default',
          apiKey: resolvedLlm.apiKey,
          baseUrl: resolvedLlm.baseUrl,
          resourceName: resolvedLlm.resourceName,
          region: resolvedLlm.region,
          accessKeyId: resolvedLlm.accessKeyId,
          secretAccessKey: resolvedLlm.secretAccessKey,
          sessionToken: resolvedLlm.sessionToken,
          browserContext: windowId ? { windowId } : undefined,
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        return c.json(
          { error: { message: errorText || 'Chat request failed' } },
          response.status as 400 | 500,
        )
      }

      // Consume the SSE stream (we don't need to process it for SDK)
      // The agent executes and we just need to know it completed
      const reader = response.body?.getReader()
      if (reader) {
        while (true) {
          const { done } = await reader.read()
          if (done) break
        }
      }

      // Clean up the session after use
      await fetch(`${chatUrl}/${conversationId}`, { method: 'DELETE' })

      return c.json({
        success: true,
        steps: [],
      })
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Action execution failed'
      logger.error('SDK act error', { instruction, error: message })
      return c.json({ error: { message } }, 500)
    }
  })

  // POST /sdk/extract - Extract structured data from the page
  sdk.post('/extract', validateRequest(ExtractRequestSchema), async (c) => {
    const { instruction, schema, context } = c.get('validatedBody') as z.infer<
      typeof ExtractRequestSchema
    >

    logger.info('SDK extract request (using remote extraction service)', {
      instruction,
    })

    try {
      // Get active tab via MCP
      const activeTabResult = await callMcpTool<ActiveTabResult>(
        mcpServerUrl,
        'browser_get_active_tab',
        {},
      )

      if (
        activeTabResult.isError ||
        !activeTabResult.structuredContent?.tabId
      ) {
        return c.json({ error: { message: 'Failed to get active tab' } }, 500)
      }

      const tabId = activeTabResult.structuredContent.tabId

      // Get page content via MCP
      const contentResult = await callMcpTool<PageContentResult>(
        mcpServerUrl,
        'browser_get_page_content',
        { tabId, type: 'text' },
      )

      if (contentResult.isError) {
        return c.json({ error: { message: 'Failed to get page content' } }, 500)
      }

      // Extract page content from structured content or text
      const pageContent =
        contentResult.structuredContent?.content ||
        getTextContent(contentResult)

      if (!pageContent) {
        return c.json({ error: { message: 'No content found on page' } }, 400)
      }

      // Call remote extraction service
      const response = await fetch(
        `${EXTERNAL_URLS.CODEGEN_SERVICE}/api/extract`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            instruction,
            schema,
            content: pageContent,
            context,
          }),
        },
      )

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        const errorMessage =
          (errorData as { error?: string }).error || 'Extraction service failed'
        const status =
          response.status >= 400 && response.status < 600
            ? response.status
            : 500
        return c.json({ error: { message: errorMessage } }, status as 400 | 500)
      }

      const result = await response.json()
      return c.json({ data: (result as { data: unknown }).data })
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Extraction failed'
      logger.error('SDK extract error', { instruction, error: message })
      return c.json({ error: { message } }, 500)
    }
  })

  // POST /sdk/verify - Verify a condition on the page
  sdk.post('/verify', validateRequest(VerifyRequestSchema), async (c) => {
    const { expectation, context, llm } = c.get('validatedBody') as z.infer<
      typeof VerifyRequestSchema
    >

    logger.info('SDK verify request', { expectation })

    try {
      // Get active tab via MCP
      const activeTabResult = await callMcpTool<ActiveTabResult>(
        mcpServerUrl,
        'browser_get_active_tab',
        {},
      )

      if (
        activeTabResult.isError ||
        !activeTabResult.structuredContent?.tabId
      ) {
        return c.json({ error: { message: 'Failed to get active tab' } }, 500)
      }

      const tabId = activeTabResult.structuredContent.tabId

      // Get screenshot and page content via MCP in parallel
      const [screenshotResult, contentResult] = await Promise.all([
        callMcpTool(mcpServerUrl, 'browser_get_screenshot', {
          tabId,
          size: 'medium',
        }),
        callMcpTool<PageContentResult>(
          mcpServerUrl,
          'browser_get_page_content',
          { tabId, type: 'text' },
        ),
      ])

      if (screenshotResult.isError) {
        return c.json(
          { error: { message: 'Failed to capture screenshot' } },
          500,
        )
      }

      // Extract page content
      const pageContent =
        contentResult.structuredContent?.content ||
        getTextContent(contentResult)

      // Get image from MCP response
      const image = getImageContent(screenshotResult)
      if (!image) {
        return c.json({ error: { message: 'Screenshot not available' } }, 500)
      }

      // Create LLM client
      const llmConfig: LLMConfig = llm ?? { provider: LLM_PROVIDERS.BROWSEROS }
      const client = await LLMClient.create(llmConfig, browserosId)

      // Build multimodal prompt with simple SUCCESS/FAILURE markers
      let textPrompt = `Verify this expectation about the current page:

${expectation}

Look at the screenshot and page content. Determine if the expectation is met.

Your response MUST start with exactly one of these words:
- SUCCESS - if the expectation is met
- FAILURE - if the expectation is NOT met

Then explain your reasoning.`

      if (context) {
        textPrompt += `\n\nAdditional context:\n${JSON.stringify(context, null, 2)}`
      }
      textPrompt += `\n\nPage text content:\n${pageContent}`

      // Build image URL from base64
      const imageUrl = `data:${image.mimeType};base64,${image.data}`

      const messages: ModelMessage[] = [
        {
          role: 'user',
          content: [
            { type: 'image', image: imageUrl },
            { type: 'text', text: textPrompt },
          ],
        },
      ]

      // Use generateText instead of structured output for broader model compatibility
      const response = await client.generateText(messages)

      // Parse SUCCESS/FAILURE from response
      const trimmed = response.trim()
      const success = /^SUCCESS\b/i.test(trimmed)
      const reason = trimmed.replace(/^(SUCCESS|FAILURE)\s*/i, '').trim()

      return c.json({ success, reason })
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Verification failed'
      logger.error('SDK verify error', { expectation, error: message })
      return c.json({ error: { message } }, 500)
    }
  })

  return sdk
}
