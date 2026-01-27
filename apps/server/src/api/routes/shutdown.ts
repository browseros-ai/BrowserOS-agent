/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { Hono } from 'hono'

interface ShutdownRouteConfig {
  onShutdown: () => void
}

export function createShutdownRoute(config: ShutdownRouteConfig) {
  return new Hono().post('/', (c) => {
    setImmediate(config.onShutdown)
    return c.json({ status: 'ok' })
  })
}
