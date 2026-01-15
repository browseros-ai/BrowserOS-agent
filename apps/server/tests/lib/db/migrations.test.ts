/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import { Database } from 'bun:sqlite'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

import { runMigrations } from '../../../src/lib/db/migrations'

describe('migrations', () => {
  let db: Database

  beforeEach(() => {
    db = new Database(':memory:')
  })

  afterEach(() => {
    db.close()
  })

  test('applies all migrations', () => {
    runMigrations(db)

    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all() as { name: string }[]

    const tableNames = tables.map((t) => t.name)
    expect(tableNames).toContain('identity')
    expect(tableNames).toContain('rate_limiter')
    expect(tableNames).toContain('conversations')
    expect(tableNames).toContain('messages')
    expect(tableNames).toContain('_migrations')
  })

  test('is idempotent', () => {
    runMigrations(db)
    runMigrations(db)

    const migrations = db.prepare('SELECT * FROM _migrations').all()

    expect(migrations.length).toBeGreaterThan(0)
  })

  test('records applied migrations', () => {
    runMigrations(db)

    const applied = db
      .prepare('SELECT version, name FROM _migrations ORDER BY version')
      .all() as { version: number; name: string }[]

    expect(applied.length).toBeGreaterThanOrEqual(2)
    expect(applied[0].name).toBe('initial_schema')
    expect(applied[1].name).toBe('conversations')
    expect(applied[0].version).toBeGreaterThan(1700000000)
  })

  test('creates indexes', () => {
    runMigrations(db)

    const indexes = db
      .prepare("SELECT name FROM sqlite_master WHERE type='index'")
      .all() as { name: string }[]

    const indexNames = indexes.map((i) => i.name)
    expect(indexNames).toContain('idx_conversations_browseros_id')
    expect(indexNames).toContain('idx_messages_conversation_id')
    expect(indexNames).toContain('idx_rate_limiter_browseros_id_date')
  })

  test('identity table has CHECK constraint', () => {
    runMigrations(db)

    db.exec("INSERT INTO identity (id, browseros_id) VALUES (1, 'test-id')")

    expect(() => {
      db.exec(
        "INSERT INTO identity (id, browseros_id) VALUES (2, 'another-id')",
      )
    }).toThrow()
  })

  test('messages role has CHECK constraint', () => {
    runMigrations(db)

    db.exec(`
      INSERT INTO conversations (id, browseros_id, provider)
      VALUES ('conv-1', 'test-browseros', 'anthropic')
    `)

    db.exec(`
      INSERT INTO messages (id, conversation_id, role, content)
      VALUES ('msg-1', 'conv-1', 'user', 'Hello')
    `)

    expect(() => {
      db.exec(`
        INSERT INTO messages (id, conversation_id, role, content)
        VALUES ('msg-2', 'conv-1', 'invalid_role', 'Oops')
      `)
    }).toThrow()
  })

  test('messages cascade delete when conversation deleted', () => {
    runMigrations(db)
    db.exec('PRAGMA foreign_keys = ON')

    db.exec(`
      INSERT INTO conversations (id, browseros_id, provider)
      VALUES ('conv-1', 'test-browseros', 'anthropic')
    `)

    db.exec(`
      INSERT INTO messages (id, conversation_id, role, content)
      VALUES ('msg-1', 'conv-1', 'user', 'Hello'),
             ('msg-2', 'conv-1', 'assistant', 'Hi there')
    `)

    const messagesBefore = db
      .prepare('SELECT COUNT(*) as count FROM messages')
      .get() as { count: number }
    expect(messagesBefore.count).toBe(2)

    db.exec("DELETE FROM conversations WHERE id = 'conv-1'")

    const messagesAfter = db
      .prepare('SELECT COUNT(*) as count FROM messages')
      .get() as { count: number }
    expect(messagesAfter.count).toBe(0)
  })
})
