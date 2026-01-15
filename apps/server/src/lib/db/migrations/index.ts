/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import type { Database } from 'bun:sqlite'

import { logger } from '../../logger'
import { migrations } from './versions'

interface AppliedMigration {
  version: number
}

function splitStatements(sql: string): string[] {
  return sql
    .split('--> statement-breakpoint')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

export function runMigrations(db: Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)

  const applied = db
    .prepare('SELECT version FROM _migrations')
    .all() as AppliedMigration[]

  const appliedVersions = new Set(applied.map((m) => m.version))

  const pending = migrations
    .filter((m) => !appliedVersions.has(m.version))
    .sort((a, b) => a.version - b.version)

  if (pending.length === 0) {
    logger.debug('No pending migrations')
    return
  }

  logger.info(`Running ${pending.length} migration(s)...`)

  for (const migration of pending) {
    logger.info(`Applying migration ${migration.version}: ${migration.name}`)

    const transaction = db.transaction(() => {
      const statements = splitStatements(migration.up)
      for (const statement of statements) {
        db.exec(statement)
      }
      db.prepare('INSERT INTO _migrations (version, name) VALUES (?, ?)').run(
        migration.version,
        migration.name,
      )
    })

    try {
      transaction()
      logger.info(`Migration ${migration.version} applied successfully`)
    } catch (error) {
      logger.error(`Migration ${migration.version} failed`, {
        name: migration.name,
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  logger.info('All migrations applied successfully')
}
