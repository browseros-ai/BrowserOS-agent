/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { LLM_PROVIDERS } from '@browseros/shared/schemas/llm'
import { createMiddleware } from 'hono/factory'
import type { RateLimiter } from '../../lib/rate-limiter/rate-limiter'
import type { ChatRequest } from '../types'

interface RateLimitMiddlewareDeps {
  rateLimiter?: RateLimiter
  browserosId?: string
}

type ChatValidationInput = {
  in: { json: ChatRequest }
  out: { json: ChatRequest }
}

export function createBrowserosRateLimitMiddleware(
  deps: RateLimitMiddlewareDeps,
) {
  return createMiddleware<object, '*', ChatValidationInput>(async (c, next) => {
    const { rateLimiter, browserosId } = deps

    if (!rateLimiter || !browserosId) {
      return next()
    }

    const request = c.req.valid('json')

    if (request.provider === LLM_PROVIDERS.BROWSEROS) {
      rateLimiter.check(browserosId)
      rateLimiter.record({
        conversationId: request.conversationId,
        browserosId,
        provider: request.provider,
      })
    }

    return next()
  })
}
