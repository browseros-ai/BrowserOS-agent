/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { Hono } from 'hono'
import { getCodexStatus } from '../../lib/clients/llm/codex-auth'

export function createCodexRoutes() {
  return new Hono().get('/status', async (c) => {
    return c.json(await getCodexStatus())
  })
}
