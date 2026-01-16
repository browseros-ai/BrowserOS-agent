/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import { sql } from 'drizzle-orm'
import { index, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const rateLimiter = sqliteTable(
  'rate_limiter',
  {
    id: text('id').primaryKey(),
    browserosId: text('browseros_id').notNull(),
    provider: text('provider').notNull(),
    createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  },
  (table) => ({
    browserosIdDateIdx: index('idx_rate_limiter_browseros_id_date').on(
      table.browserosId,
      table.createdAt,
    ),
  }),
)
