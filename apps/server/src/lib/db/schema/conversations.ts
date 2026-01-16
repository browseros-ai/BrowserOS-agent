/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import { sql } from 'drizzle-orm'
import { check, index, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const conversations = sqliteTable(
  'conversations',
  {
    id: text('id').primaryKey(),
    browserosId: text('browseros_id').notNull(),
    provider: text('provider').notNull(),
    model: text('model'),
    title: text('title'),
    createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
    updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
  },
  (table) => ({
    browserosIdIdx: index('idx_conversations_browseros_id').on(
      table.browserosId,
    ),
  }),
)

export const messages = sqliteTable(
  'messages',
  {
    id: text('id').primaryKey(),
    conversationId: text('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    role: text('role', { enum: ['user', 'assistant', 'system'] }).notNull(),
    content: text('content').notNull(),
    createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  },
  (table) => ({
    conversationIdIdx: index('idx_messages_conversation_id').on(
      table.conversationId,
    ),
    roleCheck: check(
      'role_check',
      sql`${table.role} IN ('user', 'assistant', 'system')`,
    ),
  }),
)
