/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import { Database } from 'bun:sqlite'
import { existsSync, renameSync, unlinkSync } from 'node:fs'

import { logger } from '../logger'
import { createDrizzleClient, type DrizzleDb } from './client'
import { runMigrations } from './migrations'

let db: Database | null = null
let drizzleDb: DrizzleDb | null = null

function openAndMigrate(dbPath: string): Database {
  const sqliteDb = new Database(dbPath)
  sqliteDb.exec('PRAGMA journal_mode = WAL')
  sqliteDb.exec('PRAGMA foreign_keys = ON')
  runMigrations(sqliteDb)
  return sqliteDb
}

function nukeAndRetry(dbPath: string): Database {
  const backupPath = `${dbPath}.bak`

  logger.warn('Backing up corrupted database', { from: dbPath, to: backupPath })

  // Remove old backup if exists
  if (existsSync(backupPath)) {
    unlinkSync(backupPath)
  }

  // Backup current db
  if (existsSync(dbPath)) {
    renameSync(dbPath, backupPath)
  }

  // Also clean up WAL files
  const walPath = `${dbPath}-wal`
  const shmPath = `${dbPath}-shm`
  if (existsSync(walPath)) unlinkSync(walPath)
  if (existsSync(shmPath)) unlinkSync(shmPath)

  logger.info('Creating fresh database')
  return openAndMigrate(dbPath)
}

export function initializeDb(dbPath: string): DrizzleDb {
  if (drizzleDb) {
    return drizzleDb
  }

  logger.info('Initializing database', { path: dbPath })

  try {
    db = openAndMigrate(dbPath)
  } catch (error) {
    logger.error('Migration failed, attempting recovery', {
      error: error instanceof Error ? error.message : String(error),
    })

    // Close if partially opened
    if (db) {
      db.close()
      db = null
    }

    // Nuke and retry - if this fails, let it crash
    db = nukeAndRetry(dbPath)
  }

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

export function closeDb(): void {
  if (db) {
    db.close()
    db = null
    drizzleDb = null
  }
}

export * from './schema'
export type { DrizzleDb }
