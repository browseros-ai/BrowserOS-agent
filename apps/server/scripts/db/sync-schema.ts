#!/usr/bin/env bun
/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Syncs Drizzle schema changes to embedded migrations in versions.ts
 *
 * This script:
 * 1. Runs drizzle-kit generate to detect schema changes
 * 2. Reads any new migration SQL files
 * 3. Appends them to src/lib/db/migrations/versions.ts with Unix timestamps
 * 4. Tracks synced drizzle tags in .synced.json to avoid duplicates
 */

import { execSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const DRIZZLE_DIR = './drizzle'
const VERSIONS_FILE = './src/lib/db/migrations/versions.ts'
const JOURNAL_FILE = join(DRIZZLE_DIR, 'meta/_journal.json')
const SYNCED_FILE = join(DRIZZLE_DIR, '.synced.json')

interface JournalEntry {
  idx: number
  version: string
  when: number
  tag: string
  breakpoints: boolean
}

interface Journal {
  version: string
  dialect: string
  entries: JournalEntry[]
}

function getSyncedTags(): Set<string> {
  if (!existsSync(SYNCED_FILE)) {
    return new Set()
  }
  const data = JSON.parse(readFileSync(SYNCED_FILE, 'utf-8'))
  return new Set(data.tags || [])
}

function saveSyncedTags(tags: Set<string>): void {
  writeFileSync(SYNCED_FILE, JSON.stringify({ tags: [...tags] }, null, 2))
}

function generateMigrationEntry(name: string, sql: string): string {
  const version = Math.floor(Date.now() / 1000)
  const escapedSql = sql.replace(/`/g, '\\`').replace(/\$/g, '\\$')

  return `  {
    version: ${version},
    name: '${name}',
    up: \`
${escapedSql}
    \`,
  },`
}

function appendMigration(entry: string): void {
  const content = readFileSync(VERSIONS_FILE, 'utf-8')

  const lastBracketIndex = content.lastIndexOf(']')
  if (lastBracketIndex === -1) {
    throw new Error('Could not find migrations array in versions.ts')
  }

  const before = content.slice(0, lastBracketIndex)
  const after = content.slice(lastBracketIndex)

  const needsNewline = !before.trim().endsWith(',')
  const newContent = `${before}${needsNewline ? '\n' : ''}${entry}\n${after}`

  writeFileSync(VERSIONS_FILE, newContent)
}

async function main() {
  console.log('🔄 Checking for schema changes...')

  try {
    execSync('bunx drizzle-kit generate', {
      stdio: 'pipe',
      cwd: process.cwd(),
    })
  } catch {
    // drizzle-kit returns non-zero if no changes, which is fine
  }

  if (!existsSync(JOURNAL_FILE)) {
    console.log('✅ No migrations to sync')
    return
  }

  const journal: Journal = JSON.parse(readFileSync(JOURNAL_FILE, 'utf-8'))
  const syncedTags = getSyncedTags()

  const newMigrations = journal.entries.filter(
    (entry) => !syncedTags.has(entry.tag),
  )

  if (newMigrations.length === 0) {
    console.log('✅ Schema is up to date')
    return
  }

  console.log(`📝 Found ${newMigrations.length} new migration(s)`)

  for (const migration of newMigrations) {
    const sqlFile = join(DRIZZLE_DIR, `${migration.tag}.sql`)

    if (!existsSync(sqlFile)) {
      console.warn(`⚠️  SQL file not found: ${sqlFile}`)
      continue
    }

    const sql = readFileSync(sqlFile, 'utf-8')
    const entry = generateMigrationEntry(migration.tag, sql)

    appendMigration(entry)
    syncedTags.add(migration.tag)
    console.log(`  ✅ Added migration: ${migration.tag}`)
  }

  saveSyncedTags(syncedTags)
  console.log('✨ Schema sync complete')
}

main().catch(console.error)
