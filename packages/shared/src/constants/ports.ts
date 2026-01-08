/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Centralized port configuration.
 * All port values in the monorepo should reference this file.
 *
 * in sync with:
 *   chromium/src/chrome/browser/browseros/server/browseros_server_prefs.h
 */

/**
 * Production ports (base 9000, offset 100)
 * Matches Chromium defaults in browseros_server_prefs.h
 */
export const DEFAULT_PORTS = {
  cdp: 9000,
  server: 9100,
  extension: 9300,
} as const

/**
 * Test ports (base 9005, offset 100)
 * Uses 05 suffix to avoid conflicts with dev server
 */
export const TEST_PORTS = {
  cdp: 9005,
  server: 9105,
  extension: 9305,
} as const

/**
 * Development ports (base 9010, offset 100)
 * Offset by 10 from default to avoid conflicts with production
 */
export const DEV_PORTS = {
  cdp: 9010,
  server: 9110,
  extension: 9310,
} as const

export type Ports = typeof DEFAULT_PORTS
