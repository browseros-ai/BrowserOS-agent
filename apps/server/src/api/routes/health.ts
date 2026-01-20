/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { Hono } from 'hono'
import type { HealthWatchdog } from '../../lib/health-watchdog'

interface HealthRouteConfig {
  watchdog?: HealthWatchdog
}

/**
 * Health check route group.
 * Records health check timestamps for the watchdog (if enabled).
 */
export function createHealthRoute(config: HealthRouteConfig = {}) {
  return new Hono().get('/', (c) => {
    config.watchdog?.recordHealthCheck()
    return c.json({ status: 'ok' })
  })
}
