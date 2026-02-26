/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { EXIT_CODES } from '@browseros/shared/constants/exit-codes'
import { Hono } from 'hono'
import type { Browser } from '../../browser/browser'
import { logger } from '../../lib/logger'

const HEALTH_CHECK_TIMEOUT = 5 * 60 * 1000 // 5 minutes

interface HealthDeps {
  browser?: Browser
}

export function createHealthRoute(deps: HealthDeps = {}) {
  let watchdogTimer: ReturnType<typeof setTimeout> | null = null

  function resetWatchdog() {
    if (watchdogTimer) clearTimeout(watchdogTimer)
    watchdogTimer = setTimeout(() => {
      logger.error(
        'No health check received in 5 minutes, Chromium may be gone — exiting',
      )
      process.exit(EXIT_CODES.GENERAL_ERROR)
    }, HEALTH_CHECK_TIMEOUT)
  }

  // Start the watchdog on creation
  resetWatchdog()

  return new Hono().get('/', (c) => {
    resetWatchdog()
    const cdpConnected = deps.browser?.isCdpConnected() ?? true
    return c.json({ status: 'ok', cdpConnected })
  })
}
