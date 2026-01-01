/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * SDK Routes - REST API for @browseros/agent-sdk
 * Uses MCP client for browser operations, LLM client for AI operations.
 */

import { PATHS } from '@browseros/shared/constants/paths'
import type { LLMConfig } from '@browseros/shared/types/llm'
import type { ModelMessage } from 'ai'
import { Hono } from 'hono'
import { z } from 'zod'
import { GeminiAgent } from '../../agent/agent/GeminiAgent.js'
import { AIProvider } from '../../agent/agent/gemini-vercel-sdk-adapter/types.js'
import { LLMClient } from '../../agent/llm/client.js'
import type { Logger } from '../../common/index.js'
import type { Env } from '../types.js'
import {
  callMcpTool,
  getImageContent,
  getTextContent,
} from '../utils/mcp-client.js'
import { validateRequest } from '../utils/validation.js'

// LLM config schema (matches SDK LLMConfig type)
const LLMConfigSchema = z.object({
  provider: z.enum([
    'anthropic',
    'openai',
    'google',
    'openrouter',
    'azure',
    'ollama',
    'lmstudio',
    'bedrock',
    'browseros',
    'openai-compatible',
  ]),
  model: z.string().optional(),
  apiKey: z.string().optional(),
  baseUrl: z.string().optional(),
  resourceName: z.string().optional(),
  region: z.string().optional(),
  accessKeyId: z.string().optional(),
  secretAccessKey: z.string().optional(),
  sessionToken: z.string().optional(),
})

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
  llm: LLMConfigSchema.optional(),
})

const VerifyRequestSchema = z.object({
  expectation: z.string().min(1),
  context: z.record(z.unknown()).optional(),
  llm: LLMConfigSchema.optional(),
})

interface SdkRouteDeps {
  port: number
  logger: Logger
  tempDir?: string
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
  const { port, logger, tempDir, browserosId } = deps

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
  sdk.post('/act', validateRequest(ActRequestSchema), async (c) => {
    const { instruction, context, maxSteps, windowId, llm } = c.get(
      'validatedBody',
    ) as z.infer<typeof ActRequestSchema>

    logger.info('SDK act request', { instruction, maxSteps, windowId })

    // Resolve LLM config: use provided config or default to BROWSEROS
    const resolvedLlm = llm ?? { provider: 'browseros' as const }

    // Map SDK provider string to AIProvider enum
    const providerMap: Record<string, AIProvider> = {
      anthropic: AIProvider.ANTHROPIC,
      openai: AIProvider.OPENAI,
      google: AIProvider.GOOGLE,
      openrouter: AIProvider.OPENROUTER,
      azure: AIProvider.AZURE,
      ollama: AIProvider.OLLAMA,
      lmstudio: AIProvider.LMSTUDIO,
      bedrock: AIProvider.BEDROCK,
      browseros: AIProvider.BROWSEROS,
      'openai-compatible': AIProvider.OPENAI_COMPATIBLE,
    }

    const provider = providerMap[resolvedLlm.provider]
    if (!provider) {
      return c.json(
        { error: { message: `Unknown provider: ${resolvedLlm.provider}` } },
        400,
      )
    }

    // BROWSEROS provider requires model (it gets resolved from config)
    // Other providers require explicit model
    if (provider !== AIProvider.BROWSEROS && !resolvedLlm.model) {
      return c.json(
        { error: { message: 'model is required for non-browseros providers' } },
        400,
      )
    }

    try {
      // Create throwaway agent for this request
      const conversationId = crypto.randomUUID()

      const agent = await GeminiAgent.create({
        conversationId,
        provider,
        model: resolvedLlm.model ?? 'default',
        apiKey: resolvedLlm.apiKey,
        baseUrl: resolvedLlm.baseUrl,
        resourceName: resolvedLlm.resourceName,
        region: resolvedLlm.region,
        accessKeyId: resolvedLlm.accessKeyId,
        secretAccessKey: resolvedLlm.secretAccessKey,
        sessionToken: resolvedLlm.sessionToken,
        tempDir: tempDir ?? PATHS.DEFAULT_TEMP_DIR,
        mcpServerUrl,
        browserosId,
      })

      // Build message with context if provided
      let message = instruction
      if (context) {
        message = `${instruction}\n\nContext:\n${JSON.stringify(context, null, 2)}`
      }

      // Execute agent (no streaming for SDK - we collect results)
      const noopStream = { write: async () => {} }

      await agent.execute(
        message,
        noopStream,
        undefined,
        windowId ? { windowId } : undefined,
      )

      // Return success (agent completed)
      // TODO: Collect actual steps from agent execution
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
    const { instruction, schema, context, llm } = c.get(
      'validatedBody',
    ) as z.infer<typeof ExtractRequestSchema>

    logger.info('SDK extract request', { instruction })

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

      // Create LLM client
      const llmConfig: LLMConfig = llm ?? { provider: 'browseros' }
      const client = await LLMClient.create(llmConfig, browserosId)

      // Build prompt
      let prompt = `Extract the following from this page:\n\n${instruction}`
      if (context) {
        prompt += `\n\nAdditional context:\n${JSON.stringify(context, null, 2)}`
      }
      prompt += `\n\nPage content:\n${pageContent}`

      const messages: ModelMessage[] = [{ role: 'user', content: prompt }]

      // Generate structured output
      const data = await client.generateStructuredOutput(messages, schema)

      return c.json({ data })
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
      const llmConfig: LLMConfig = llm ?? { provider: 'browseros' }
      const client = await LLMClient.create(llmConfig, browserosId)

      // Build multimodal prompt
      let textPrompt = `Verify this expectation about the current page:\n\n${expectation}`
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

      // Fixed response schema for verify
      const verifySchema = {
        type: 'object' as const,
        properties: {
          success: { type: 'boolean' as const },
          reason: { type: 'string' as const },
        },
        required: ['success', 'reason'],
      }

      const result = await client.generateStructuredOutput<{
        success: boolean
        reason: string
      }>(messages, verifySchema)

      return c.json(result)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Verification failed'
      logger.error('SDK verify error', { expectation, error: message })
      return c.json({ error: { message } }, 500)
    }
  })

  return sdk
}
