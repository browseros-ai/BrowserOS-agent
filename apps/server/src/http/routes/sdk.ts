/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * SDK Routes - REST API for @browseros/agent-sdk
 */

import { PATHS } from '@browseros/shared/paths'
import { Hono } from 'hono'
import { z } from 'zod'
import { GeminiAgent } from '../../agent/agent/GeminiAgent.js'
import { AIProvider } from '../../agent/agent/gemini-vercel-sdk-adapter/types.js'
import type { Logger } from '../../common/index.js'
import type { ControllerContext } from '../../controller-server/index.js'
import type { Env } from '../types.js'
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
  controllerContext: ControllerContext
  logger: Logger
  port: number
  tempDir?: string
  browserosId?: string
}

export function createSdkRoutes(deps: SdkRouteDeps) {
  const { controllerContext, logger, port, tempDir, browserosId } = deps

  const mcpServerUrl = `http://127.0.0.1:${port}/mcp`

  const sdk = new Hono<Env>()

  // POST /sdk/nav - Navigate to a URL
  sdk.post('/nav', validateRequest(NavRequestSchema), async (c) => {
    const { url, tabId, windowId } = c.get('validatedBody') as z.infer<
      typeof NavRequestSchema
    >

    logger.info('SDK nav request', { url, tabId, windowId })

    try {
      await controllerContext.executeAction('navigate', {
        url,
        tabId,
        windowId,
      })
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
      // For now, we pass a no-op stream since execute() requires it
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

    // TODO: Implement extraction with LLM
    return c.json(
      {
        error: {
          message: 'extract() not yet implemented - coming soon',
        },
      },
      501,
    )
  })

  // POST /sdk/verify - Verify a condition on the page
  sdk.post('/verify', validateRequest(VerifyRequestSchema), async (c) => {
    const { expectation, context, llm } = c.get('validatedBody') as z.infer<
      typeof VerifyRequestSchema
    >

    logger.info('SDK verify request', { expectation })

    // TODO: Implement verification with LLM
    return c.json(
      {
        error: {
          message: 'verify() not yet implemented - coming soon',
        },
      },
      501,
    )
  })

  return sdk
}
