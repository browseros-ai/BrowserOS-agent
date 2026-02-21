/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

export function serializeError(error: unknown): Record<string, unknown> {
  if (!(error instanceof Error)) {
    return { message: String(error) }
  }
  const result: Record<string, unknown> = {
    message: error.message,
    stack: error.stack,
  }
  if (error.cause) {
    result.cause = serializeError(error.cause)
  }
  return result
}
