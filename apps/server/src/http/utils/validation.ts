/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import type { Context, Next } from 'hono'
import { z } from 'zod'
import { ValidationError } from '../../agent/errors'
import { logger } from '../../common/logger'

const SESSION_ID_PATTERN = /^[a-zA-Z0-9_-]+$/

export const SessionIdSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(SESSION_ID_PATTERN, 'Invalid session ID format')

interface ValidationVariables {
  validatedBody: unknown
}

/**
 * Middleware factory for request body validation using Zod schemas.
 *
 * @param schema - Zod schema to validate request body against
 * @returns Hono middleware that validates and sets validatedBody variable
 *
 * @example
 * ```typescript
 * app.post('/chat', validateRequest(ChatRequestSchema), async (c) => {
 *   const request = c.get('validatedBody') as ChatRequest
 *   // ... handle request
 * })
 * ```
 */
export function validateSessionId(paramName = 'id') {
  return async (c: Context, next: Next) => {
    const sessionId = c.req.param(paramName)
    const result = SessionIdSchema.safeParse(sessionId)

    if (!result.success) {
      logger.warn('Invalid session ID', {
        sessionId,
        issues: result.error.issues,
      })
      throw new ValidationError(
        'Invalid session ID format',
        result.error.issues,
      )
    }

    await next()
  }
}

export function validateRequest<T>(schema: z.ZodType<T>) {
  return async (c: Context<{ Variables: ValidationVariables }>, next: Next) => {
    try {
      const body = await c.req.json()
      const validated = schema.parse(body)
      c.set('validatedBody', validated)
      await next()
    } catch (err) {
      if (err && typeof err === 'object' && 'issues' in err) {
        const zodError = err as { issues: unknown }
        logger.warn('Request validation failed', { issues: zodError.issues })
        throw new ValidationError('Request validation failed', zodError.issues)
      }
      throw err
    }
  }
}
