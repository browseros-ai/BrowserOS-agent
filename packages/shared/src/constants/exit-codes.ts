/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Exit codes for BrowserOS server process.
 * These codes communicate startup status to the Chromium manager.
 */

export const EXIT_CODES = {
  /** Clean shutdown - don't restart */
  SUCCESS: 0,

  /** General error - Chromium should restart with same port */
  GENERAL_ERROR: 1,

  /** Port conflict after retries - Chromium should increment port and restart */
  PORT_CONFLICT: 2,
} as const

export type ExitCode = (typeof EXIT_CODES)[keyof typeof EXIT_CODES]
