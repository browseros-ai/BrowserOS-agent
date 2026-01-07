/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * SDK Routes - REST API for @browseros-ai/agent-sdk
 */

import { LLM_PROVIDERS } from '@browseros/shared/schemas/llm'
import { Hono } from 'hono'
import { logger } from '../../common/logger'
import { BrowserService } from '../services/sdk/browser'
import { ChatService } from '../services/sdk/chat'
import { ExtractService } from '../services/sdk/extract'
import {
  type ActRequest,
  ActRequestSchema,
  type ExtractRequest,
  ExtractRequestSchema,
  type NavRequest,
  NavRequestSchema,
  type SdkDeps,
  SdkError,
  type VerifyRequest,
  VerifyRequestSchema,
} from '../services/sdk/types'
import { VerifyService } from '../services/sdk/verify'
import type { Env } from '../types'
import { validateRequest } from '../utils/validation'

export function createSdkRoutes(deps: SdkDeps) {
  const { port, browserosId } = deps

  const mcpServerUrl = `http://127.0.0.1:${port}/mcp`

  const browserService = new BrowserService(mcpServerUrl)
  const chatService = new ChatService(port)
  const extractService = new ExtractService()
  const verifyService = new VerifyService()

  const sdk = new Hono<Env>()

  sdk.post('/nav', validateRequest(NavRequestSchema), async (c) => {
    const { url, tabId, windowId } = c.get('validatedBody') as NavRequest
    logger.info('SDK nav request', { url, tabId, windowId })

    try {
      await browserService.navigate(url, tabId, windowId)
      return c.json({ success: true })
    } catch (error) {
      const err =
        error instanceof SdkError
          ? error
          : new SdkError(
              error instanceof Error ? error.message : 'Navigation failed',
            )
      logger.error('SDK nav error', { url, error: err.message })
      return c.json(
        { error: { message: err.message } },
        err.statusCode as 400 | 500,
      )
    }
  })

  sdk.post('/act', validateRequest(ActRequestSchema), async (c) => {
    const { instruction, context, windowId, llm } = c.get(
      'validatedBody',
    ) as ActRequest
    logger.info('SDK act request', { instruction, windowId })

    const llmConfig = llm ?? { provider: LLM_PROVIDERS.BROWSEROS }

    if (llmConfig.provider !== LLM_PROVIDERS.BROWSEROS && !llmConfig.model) {
      return c.json(
        { error: { message: 'model is required for non-browseros providers' } },
        400,
      )
    }

    try {
      await chatService.executeAction({
        instruction,
        context,
        windowId,
        llmConfig,
      })
      return c.json({ success: true, steps: [] })
    } catch (error) {
      const err =
        error instanceof SdkError
          ? error
          : new SdkError(
              error instanceof Error
                ? error.message
                : 'Action execution failed',
            )
      logger.error('SDK act error', { instruction, error: err.message })
      return c.json(
        { error: { message: err.message } },
        err.statusCode as 400 | 500,
      )
    }
  })

  sdk.post('/extract', validateRequest(ExtractRequestSchema), async (c) => {
    const { instruction, schema, context } = c.get(
      'validatedBody',
    ) as ExtractRequest
    logger.info('SDK extract request', { instruction })

    try {
      const { tabId } = await browserService.getActiveTab()
      const content = await browserService.getPageContent(tabId)
      const data = await extractService.extract({
        instruction,
        schema,
        content,
        context,
      })
      return c.json({ data })
    } catch (error) {
      const err =
        error instanceof SdkError
          ? error
          : new SdkError(
              error instanceof Error ? error.message : 'Extraction failed',
            )
      logger.error('SDK extract error', { instruction, error: err.message })
      return c.json(
        { error: { message: err.message } },
        err.statusCode as 400 | 500,
      )
    }
  })

  sdk.post('/verify', validateRequest(VerifyRequestSchema), async (c) => {
    const { expectation, context, llm } = c.get(
      'validatedBody',
    ) as VerifyRequest
    logger.info('SDK verify request', { expectation })

    const llmConfig = llm ?? { provider: LLM_PROVIDERS.BROWSEROS }

    try {
      const { tabId } = await browserService.getActiveTab()
      const [screenshot, pageContent] = await Promise.all([
        browserService.getScreenshot(tabId),
        browserService.getPageContent(tabId),
      ])

      const result = await verifyService.verify({
        expectation,
        screenshot,
        pageContent,
        context,
        llmConfig,
        browserosId,
      })

      return c.json(result)
    } catch (error) {
      const err =
        error instanceof SdkError
          ? error
          : new SdkError(
              error instanceof Error ? error.message : 'Verification failed',
            )
      logger.error('SDK verify error', { expectation, error: err.message })
      return c.json(
        { error: { message: err.message } },
        err.statusCode as 400 | 500,
      )
    }
  })

  return sdk
}
