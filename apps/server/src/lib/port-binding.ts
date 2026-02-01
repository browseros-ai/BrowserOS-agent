/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

export function isPortInUseError(error: unknown): boolean {
  if (error instanceof Error) {
    const err = error as NodeJS.ErrnoException
    return err.code === 'EADDRINUSE'
  }
  return false
}
