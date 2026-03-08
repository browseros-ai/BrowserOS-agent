import { PATHS } from '@browseros/shared/constants/paths'
import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { SessionStore } from '../../agent/session-store'
import type { Browser } from '../../browser/browser'
import { KlavisClient } from '../../lib/clients/klavis/klavis-client'
import { logger } from '../../lib/logger'
import { metrics } from '../../lib/metrics'
import type { RateLimiter } from '../../lib/rate-limiter/rate-limiter'
import { withSentryIsolationScope } from '../../lib/sentry-utils'
import type { ToolRegistry } from '../../tools/tool-registry'
import { createBrowserosRateLimitMiddleware } from '../middleware/rate-limit'
import { ChatService } from '../services/chat-service'
import { ChatRequestSchema } from '../types'
import { ConversationIdParamSchema } from '../utils/validation'

interface ChatRouteDeps {
  browser: Browser
  registry: ToolRegistry
  executionDir?: string
  browserosId?: string
  rateLimiter?: RateLimiter
}

export function createChatRoutes(deps: ChatRouteDeps) {
  const { browserosId, rateLimiter } = deps
  const executionDir = deps.executionDir || PATHS.DEFAULT_EXECUTION_DIR

  const sessionStore = new SessionStore()
  const klavisClient = new KlavisClient()
  const service = new ChatService({
    sessionStore,
    klavisClient,
    executionDir,
    browser: deps.browser,
    registry: deps.registry,
    browserosId,
  })

  return new Hono()
    .post(
      '/',
      zValidator('json', ChatRequestSchema),
      createBrowserosRateLimitMiddleware({ rateLimiter, browserosId }),
      async (c) => {
        const request = c.req.valid('json')
        const requestType = request.isScheduledTask ? 'schedule' : 'chat'

        return withSentryIsolationScope(
          {
            tags: {
              route: 'chat',
              request_type: requestType,
              provider: request.provider,
              model: request.model,
              mode: request.mode,
            },
            contexts: {
              request: {
                conversationId: request.conversationId,
                provider: request.provider,
                model: request.model,
                baseUrl: request.baseUrl,
                mode: request.mode,
                isScheduledTask: request.isScheduledTask,
                hasPreviousConversation: !!request.previousConversation?.length,
              },
            },
          },
          () => {
            metrics.log('chat.request', {
              provider: request.provider,
              model: request.model,
            })

            logger.info('Chat request received', {
              conversationId: request.conversationId,
              provider: request.provider,
              model: request.model,
            })

            return service.processMessage(request, c.req.raw.signal)
          },
        )
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
