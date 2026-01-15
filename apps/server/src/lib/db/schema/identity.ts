/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import { sql } from 'drizzle-orm'
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const identity = sqliteTable('identity', {
  id: integer('id')
    .primaryKey()
    .$default(() => 1),
  browserosId: text('browseros_id').notNull(),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
})
