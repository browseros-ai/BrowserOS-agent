/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { RATE_LIMITS } from '@browseros/shared/constants/limits'
import { count, sql } from 'drizzle-orm'

import type { DrizzleDb } from '../db'
import { rateLimiter } from '../db/schema'
import { logger } from '../logger'
import { metrics } from '../metrics'

import { RateLimitError } from './errors'

export interface RecordParams {
  conversationId: string
  browserosId: string
  provider: string
}

export class RateLimiter {
  private db: DrizzleDb
  private dailyRateLimit: number

  constructor(
    db: DrizzleDb,
    dailyRateLimit: number = RATE_LIMITS.DEFAULT_DAILY,
  ) {
    this.db = db
    this.dailyRateLimit = dailyRateLimit
  }

  check(browserosId: string): void {
    const todayCount = this.getTodayCount(browserosId)
    if (todayCount >= this.dailyRateLimit) {
      logger.warn('Rate limit exceeded', {
        browserosId,
        count: todayCount,
        dailyRateLimit: this.dailyRateLimit,
      })
      metrics.log('rate_limit.triggered', {
        count: todayCount,
        daily_limit: this.dailyRateLimit,
      })
      throw new RateLimitError(todayCount, this.dailyRateLimit)
    }
  }

  record(params: RecordParams): void {
    const { conversationId, browserosId, provider } = params
    // INSERT OR IGNORE: duplicate conversation_ids are silently ignored
    // This ensures the same conversation is only counted once for rate limiting
    this.db
      .insert(rateLimiter)
      .values({ id: conversationId, browserosId, provider })
      .onConflictDoNothing()
      .run()
  }

  private getTodayCount(browserosId: string): number {
    const result = this.db
      .select({ count: count() })
      .from(rateLimiter)
      .where(
        sql`${rateLimiter.browserosId} = ${browserosId} AND date(${rateLimiter.createdAt}) = date('now')`,
      )
      .get()
    return result?.count ?? 0
  }
}

export { RateLimitError } from './errors'
