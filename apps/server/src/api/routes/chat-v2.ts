import { PATHS } from '@browseros/shared/constants/paths'
import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { SessionStore } from '../../agent/runtime/session-store'
import { KlavisClient } from '../../lib/clients/klavis/klavis-client'
import { logger } from '../../lib/logger'
import { metrics } from '../../lib/metrics'
import type { RateLimiter } from '../../lib/rate-limiter/rate-limiter'
import { Sentry } from '../../lib/sentry'
import { createBrowserosRateLimitMiddleware } from '../middleware/rate-limit'
import { ChatV2Service } from '../services/chat-v2-service'
import { ChatRequestSchema } from '../types'
import { ConversationIdParamSchema } from '../utils/validation'

interface ChatV2RouteDeps {
  port: number
  executionDir?: string
  browserosId?: string
  rateLimiter?: RateLimiter
}

export function createChatV2Routes(deps: ChatV2RouteDeps) {
  const { port, browserosId, rateLimiter } = deps
  const mcpServerUrl = `http://127.0.0.1:${port}/mcp`
  const executionDir = deps.executionDir || PATHS.DEFAULT_EXECUTION_DIR

  // Initialize service dependencies
  const sessionStore = new SessionStore()
  const klavisClient = new KlavisClient()
  const service = new ChatV2Service({
    sessionStore,
    klavisClient,
    executionDir,
    mcpServerUrl,
    browserosId,
  })

  return new Hono()
    .post(
      '/',
      zValidator('json', ChatRequestSchema),
      createBrowserosRateLimitMiddleware({ rateLimiter, browserosId }),
      async (c) => {
        const request = c.req.valid('json')

        // Sentry + metrics (HTTP concerns only)
        Sentry.getCurrentScope().setTag(
          'request-type',
          request.isScheduledTask ? 'schedule' : 'chat',
        )
        Sentry.setContext('request', {
          provider: request.provider,
          model: request.model,
          baseUrl: request.baseUrl,
        })

        metrics.log('chat-v2.request', {
          provider: request.provider,
          model: request.model,
        })

        logger.info('Chat-v2 request received', {
          conversationId: request.conversationId,
          provider: request.provider,
          model: request.model,
        })

        return service.processMessage(request, c.req.raw.signal)
      },
    )
    .delete(
      '/:conversationId',
      zValidator('param', ConversationIdParamSchema),
      async (c) => {
        const { conversationId } = c.req.valid('param')
        const result = await service.deleteSession(conversationId)

        if (result.deleted) {
          return c.json({
            success: true,
            message: `Session ${conversationId} deleted`,
            sessionCount: result.sessionCount,
          })
        }

        return c.json(
          { success: false, message: `Session ${conversationId} not found` },
          404,
        )
      },
    )
}
