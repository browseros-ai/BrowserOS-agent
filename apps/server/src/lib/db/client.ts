/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import type { Database } from 'bun:sqlite'
import { drizzle } from 'drizzle-orm/bun-sqlite'

import * as schema from './schema'

export type DrizzleDb = ReturnType<typeof createDrizzleClient>

export function createDrizzleClient(sqliteDb: Database) {
  return drizzle(sqliteDb, { schema })
}
