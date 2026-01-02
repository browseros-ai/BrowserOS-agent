/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import type { Context, Next } from 'hono'
import { AIProvider } from '../../agent/agent/gemini-vercel-sdk-adapter/types.js'
import type { RateLimiter } from '../../agent/rate-limiter/index.js'
import type { ChatRequest } from '../types.js'

interface RateLimitMiddlewareOptions {
  rateLimiter?: RateLimiter
  browserosId?: string
}

export function browserosRateLimitMiddleware(
  options: RateLimitMiddlewareOptions,
) {
  const { rateLimiter, browserosId } = options

  return async (c: Context, next: Next) => {
    const request = c.get('validatedBody') as ChatRequest | undefined

    if (
      request &&
      request.provider === AIProvider.BROWSEROS &&
      rateLimiter &&
      browserosId
    ) {
      rateLimiter.check(browserosId)
      rateLimiter.record({
        conversationId: request.conversationId,
        browserosId,
        provider: request.provider,
      })
    }

    await next()
  }
}
