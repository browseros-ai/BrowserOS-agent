/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * SDK Routes - REST API for @browseros-ai/agent-sdk
 */

import { LLM_PROVIDERS } from '@browseros/shared/schemas/llm'
import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { stream } from 'hono/streaming'
import {
  formatUIMessageStreamDone,
  formatUIMessageStreamEvent,
  UIMessageStreamWriter,
} from '../../agent/provider-adapter/ui-message-stream'
import { logger } from '../../lib/logger'
import { BrowserService } from '../services/sdk/browser'
import { ChatService } from '../services/sdk/chat'
import { ExtractService } from '../services/sdk/extract'
import {
  ActRequestSchema,
  ExtractRequestSchema,
  NavRequestSchema,
  type SdkDeps,
  SdkError,
  VerifyRequestSchema,
} from '../services/sdk/types'
import { VerifyService } from '../services/sdk/verify'
import type { Env } from '../types'

export function createSdkRoutes(deps: SdkDeps) {
  const { port, browserosId } = deps

  const mcpServerUrl = `http://127.0.0.1:${port}/mcp`

  const browserService = new BrowserService(mcpServerUrl)
  const chatService = new ChatService(port)
  const extractService = new ExtractService()
  const verifyService = new VerifyService()

  // Chain route definitions for proper Hono RPC type inference
  return new Hono<Env>()
    .post('/nav', zValidator('json', NavRequestSchema), async (c) => {
      const { url, tabId, windowId } = c.req.valid('json')
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
    .post('/act', zValidator('json', ActRequestSchema), async (c) => {
      const { instruction, context, windowId, llm } = c.req.valid('json')
      logger.info('SDK act request', { instruction, windowId })

      const llmConfig = llm ?? { provider: LLM_PROVIDERS.BROWSEROS }

      if (llmConfig.provider !== LLM_PROVIDERS.BROWSEROS && !llmConfig.model) {
        return c.json(
          {
            error: { message: 'model is required for non-browseros providers' },
          },
          400,
        )
      }

      // Set SSE headers for Vercel AI stream
      c.header('Content-Type', 'text/event-stream')
      c.header('Cache-Control', 'no-cache')
      c.header('Connection', 'keep-alive')
      c.header('x-vercel-ai-ui-message-stream', 'v1')

      return stream(c, async (honoStream) => {
        const writer = new UIMessageStreamWriter(async (data) => {
          await honoStream.write(data)
        })

        try {
          await writer.start()

          await chatService.executeAction({
            instruction,
            context,
            windowId,
            llmConfig,
            signal: c.req.raw.signal,
            onSSEEvent: async (event) => {
              // Forward events from /chat, skip start/finish (we manage those)
              if (event.type === 'start' || event.type === 'finish') return
              await honoStream.write(formatUIMessageStreamEvent(event))
            },
          })

          await writer.finish()
        } catch (error) {
          if (error instanceof Error && error.name === 'AbortError') {
            await writer.abort()
            return
          }
          const err =
            error instanceof SdkError
              ? error
              : new SdkError(
                  error instanceof Error
                    ? error.message
                    : 'Action execution failed',
                )
          logger.error('SDK act error', { instruction, error: err.message })
          await writer.writeError(err.message)
          await honoStream.write(formatUIMessageStreamDone())
        }
      })
    })
    .post('/extract', zValidator('json', ExtractRequestSchema), async (c) => {
      const { instruction, schema, context } = c.req.valid('json')
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
    .post('/verify', zValidator('json', VerifyRequestSchema), async (c) => {
      const { expectation, context, llm } = c.req.valid('json')
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
}
