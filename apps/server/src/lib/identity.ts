/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import { eq } from 'drizzle-orm'

import type { DrizzleDb } from './db'
import { identity as identityTable } from './db/schema'

export interface IdentityConfig {
  installId?: string
  db: DrizzleDb
}

class IdentityService {
  private browserOSId: string | null = null

  initialize(config: IdentityConfig): void {
    const { installId, db } = config

    // Priority: DB > config > generate new
    this.browserOSId =
      this.loadFromDb(db) || installId || this.generateAndSave(db)
  }

  getBrowserOSId(): string {
    if (!this.browserOSId) {
      throw new Error(
        'IdentityService not initialized. Call initialize() first.',
      )
    }
    return this.browserOSId
  }

  isInitialized(): boolean {
    return this.browserOSId !== null
  }

  private loadFromDb(db: DrizzleDb): string | null {
    const row = db
      .select({ browserosId: identityTable.browserosId })
      .from(identityTable)
      .where(eq(identityTable.id, 1))
      .get()
    return row?.browserosId ?? null
  }

  private generateAndSave(db: DrizzleDb): string {
    const browserosId = crypto.randomUUID()
    db.insert(identityTable)
      .values({ id: 1, browserosId })
      .onConflictDoUpdate({
        target: identityTable.id,
        set: { browserosId },
      })
      .run()
    return browserosId
  }
}

export const identity = new IdentityService()
