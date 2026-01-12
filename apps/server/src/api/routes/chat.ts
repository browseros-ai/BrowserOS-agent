/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { PATHS } from '@browseros/shared/constants/paths'
import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { stream } from 'hono/streaming'
import { SessionManager } from '../../agent/session'
import { KlavisClient } from '../../lib/clients/klavis/klavis-client'
import { logger } from '../../lib/logger'
import { metrics } from '../../lib/metrics'
import type { RateLimiter } from '../../lib/rate-limiter/rate-limiter'
import { Sentry } from '../../lib/sentry'
import { createBrowserosRateLimitMiddleware } from '../middleware/rate-limit'
import { ChatService } from '../services/chat-service'
import { ChatRequestSchema } from '../types'
import { ConversationIdParamSchema } from '../utils/validation'

interface ChatRouteDeps {
  port: number
  tempDir?: string
  browserosId?: string
  rateLimiter?: RateLimiter
}

export function createChatRoutes(deps: ChatRouteDeps) {
  const { port, browserosId, rateLimiter } = deps

  const mcpServerUrl = `http://127.0.0.1:${port}/mcp`
  const tempDir = deps.tempDir || PATHS.DEFAULT_TEMP_DIR

  const sessionManager = new SessionManager()
  const klavisClient = new KlavisClient()

  const chatService = new ChatService({
    sessionManager,
    klavisClient,
    tempDir,
    mcpServerUrl,
    browserosId,
  })

  logger.debug('Chat routes initialized', {
    browserosId,
    mcpServerUrl,
  })

  // Chain route definitions for proper Hono RPC type inference
  return new Hono()
    .post(
      '/',
      zValidator('json', ChatRequestSchema),
      createBrowserosRateLimitMiddleware({ rateLimiter, browserosId }),
      async (c) => {
        const request = c.req.valid('json')

        Sentry.getCurrentScope().setTag(
          'request-type',
          request.isScheduledTask ? 'schedule' : 'chat',
        )
        Sentry.setContext('request', {
          provider: request.provider,
          model: request.model,
          baseUrl: request.baseUrl,
        })

        metrics.log('chat.request', {
          provider: request.provider,
          model: request.model,
        })

        logger.info('Chat request received', {
          conversationId: request.conversationId,
          provider: request.provider,
          model: request.model,
          browserContext: request.browserContext,
        })

        c.header('Content-Type', 'text/event-stream')
        c.header('x-vercel-ai-ui-message-stream', 'v1')
        c.header('Cache-Control', 'no-cache')
        c.header('Connection', 'keep-alive')

        const abortController = new AbortController()

        if (c.req.raw.signal) {
          c.req.raw.signal.addEventListener(
            'abort',
            () => abortController.abort(),
            { once: true },
          )
        }

        return stream(c, async (honoStream) => {
          honoStream.onAbort(() => {
            abortController.abort()
            metrics.log('chat.aborted', {
              provider: request.provider,
              model: request.model,
            })
          })

          const rawStream = {
            write: async (data: string): Promise<void> => {
              await honoStream.write(data)
            },
          }

          await chatService.processMessage(
            request,
            rawStream,
            abortController.signal,
          )
        })
      },
    )
    .delete(
      '/:conversationId',
      zValidator('param', ConversationIdParamSchema),
      (c) => {
        const { conversationId } = c.req.valid('param')
        const deleted = sessionManager.delete(conversationId)

        if (deleted) {
          return c.json({
            success: true,
            message: `Session ${conversationId} deleted`,
            sessionCount: sessionManager.count(),
          })
        }

        return c.json(
          {
            success: false,
            message: `Session ${conversationId} not found`,
          },
          404,
        )
      },
    )
}
