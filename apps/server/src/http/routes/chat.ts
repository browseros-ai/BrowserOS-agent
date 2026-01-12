/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { PATHS } from '@browseros/shared/constants/paths'
import { Hono } from 'hono'
import { stream } from 'hono/streaming'
import { KlavisClient } from '../../agent/klavis/klavis-client'
import type { RateLimiter } from '../../agent/rate-limiter/rate-limiter'
import { SessionManager } from '../../agent/session/session-manager'
import { logger } from '../../common/logger'
import { metrics } from '../../common/metrics'
import { Sentry } from '../../common/sentry/instrument'
import { createBrowserosRateLimitMiddleware } from '../middleware/browseros-rate-limit'
import { ChatService } from '../services/chat-service'
import type { ChatRequest } from '../types'
import { ChatRequestSchema } from '../types'
import { validateRequest } from '../utils/validation'

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

  const chat = new Hono()

  chat.post(
    '/',
    validateRequest(ChatRequestSchema),
    createBrowserosRateLimitMiddleware({ rateLimiter, browserosId }),
    async (c) => {
      const request = c.get('validatedBody') as ChatRequest

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

  chat.delete('/:conversationId', (c) => {
    const conversationId = c.req.param('conversationId')
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
  })

  return chat
}
