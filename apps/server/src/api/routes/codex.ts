/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { Hono } from 'hono'
import { getCodexStatus } from '../../lib/clients/llm/codex-auth'
import { logger } from '../../lib/logger'

export function createCodexRoutes() {
  return new Hono().get('/status', async (c) => {
    try {
      return c.json(await getCodexStatus())
    } catch (error) {
      logger.error('Error reading Codex status', {
        error: error instanceof Error ? error.message : String(error),
      })
      return c.json({ error: 'Failed to read Codex status' }, 500)
    }
  })
}
