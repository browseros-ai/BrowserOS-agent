/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import { Database } from 'bun:sqlite'

import { logger } from '../logger'
import { createDrizzleClient, type DrizzleDb } from './client'
import { runMigrations } from './migrations'

let db: Database | null = null
let drizzleDb: DrizzleDb | null = null

export function initializeDb(dbPath: string): DrizzleDb {
  if (drizzleDb) {
    return drizzleDb
  }

  logger.info('Initializing database', { path: dbPath })

  db = new Database(dbPath)
  db.exec('PRAGMA journal_mode = WAL')
  db.exec('PRAGMA foreign_keys = ON')

  runMigrations(db)

  drizzleDb = createDrizzleClient(db)

  logger.info('Database initialized successfully')
  return drizzleDb
}

export function getDb(): DrizzleDb {
  if (!drizzleDb) {
    throw new Error('Database not initialized. Call initializeDb() first.')
  }
  return drizzleDb
}

export function getRawDb(): Database {
  if (!db) {
    throw new Error('Database not initialized. Call initializeDb() first.')
  }
  return db
}

export function closeDb(): void {
  if (db) {
    db.close()
    db = null
    drizzleDb = null
  }
}

export * from './schema'
export type { DrizzleDb }
