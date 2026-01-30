/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { Hono } from 'hono'

export function createHealthRoute() {
  return new Hono().get('/', (c) => {
    return c.json({ status: 'ok' })
  })
}
