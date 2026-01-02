/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { Hono } from 'hono'
import { stream } from 'hono/streaming'
import type { RateLimiter } from '../../agent/rate-limiter/index.js'
import type { SessionManager } from '../../agent/session/SessionManager.js'
import { logger } from '../../common/index.js'
import { Sentry } from '../../common/sentry/instrument.js'
import type { ChatService } from '../../services/ChatService.js'
import { browserosRateLimitMiddleware } from '../middleware/browseros-rate-limit.js'
import type { ChatRequest } from '../types.js'
import { ChatRequestSchema } from '../types.js'
import { validateRequest } from '../utils/validation.js'

interface ChatRouteDeps {
  chatService: ChatService
  sessionManager: SessionManager
  browserosId?: string
  rateLimiter?: RateLimiter
}

export function createChatRoutes(deps: ChatRouteDeps) {
  const { chatService, sessionManager, browserosId, rateLimiter } = deps

  const chat = new Hono()

  const rateLimitMiddleware = browserosRateLimitMiddleware({
    rateLimiter,
    browserosId,
  })

  chat.post(
    '/',
    validateRequest(ChatRequestSchema),
    rateLimitMiddleware,
    async (c) => {
      const request = c.get('validatedBody') as ChatRequest

      const { provider, model, baseUrl } = request

      Sentry.setContext('request', { provider, model, baseUrl })

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
      const abortSignal = abortController.signal

      if (c.req.raw.signal) {
        c.req.raw.signal.addEventListener(
          'abort',
          () => {
            abortController.abort()
          },
          { once: true },
        )
      }

      return stream(c, async (honoStream) => {
        honoStream.onAbort(() => {
          abortController.abort()
        })

        const sseStream = {
          write: async (data: string): Promise<void> => {
            await honoStream.write(data)
          },
        }

        try {
          await chatService.processMessage(
            request,
            sseStream,
            abortSignal,
            request.browserContext,
          )
        } catch (error) {
          logger.error('Chat request failed', {
            conversationId: request.conversationId,
            error:
              error instanceof Error ? error.message : 'Chat request failed',
          })
          throw error
        }
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
