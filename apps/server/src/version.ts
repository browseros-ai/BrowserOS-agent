/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

// Replaced at build time via `define` in scripts/build/server.ts
declare const __BROWSEROS_VERSION__: string

export const VERSION: string =
  typeof __BROWSEROS_VERSION__ !== 'undefined'
    ? __BROWSEROS_VERSION__
    : '0.0.0-dev'
