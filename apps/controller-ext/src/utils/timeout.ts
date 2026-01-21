/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

/**
 * Timeout configuration for different Chrome API operations.
 * These prevent hung Chrome APIs from blocking the ConcurrencyLimiter mutex.
 */
export const CHROME_API_TIMEOUTS = {
  // Window operations
  WINDOW_CREATE: 30_000,
  WINDOW_CLOSE: 30_000,

  // Tab operations
  TAB_QUERY: 10_000,
  TAB_CREATE: 15_000,
  TAB_CLOSE: 15_000,
  TAB_UPDATE: 10_000,
  TAB_GROUP: 15_000,

  // BrowserOS operations (heavier)
  SCREENSHOT: 60_000,
  INTERACTIVE_SNAPSHOT: 45_000,
  SNAPSHOT: 30_000,
  ACCESSIBILITY_TREE: 30_000,
  PAGE_LOAD_STATUS: 30_000,

  // BrowserOS actions (quick)
  CLICK: 10_000,
  INPUT_TEXT: 10_000,
  CLEAR: 10_000,
  SCROLL: 10_000,
  SEND_KEYS: 10_000,
  EXECUTE_JS: 30_000,

  // Bookmark/History operations
  BOOKMARK_QUERY: 10_000,
  BOOKMARK_MODIFY: 10_000,
  HISTORY_QUERY: 15_000,

  // Default fallback
  DEFAULT: 30_000,
} as const

export type TimeoutKey = keyof typeof CHROME_API_TIMEOUTS

/**
 * Error thrown when a Chrome API call times out.
 */
export class ChromeAPITimeoutError extends Error {
  constructor(
    public readonly operation: string,
    public readonly timeoutMs: number,
  ) {
    super(`Chrome API '${operation}' timed out after ${timeoutMs}ms`)
    this.name = 'ChromeAPITimeoutError'
  }
}

/**
 * Wraps a promise with a timeout. If the promise doesn't resolve within
 * the specified time, it rejects with a ChromeAPITimeoutError.
 *
 * IMPORTANT: This doesn't cancel the underlying Chrome API call - it just
 * stops waiting for it. The API call may still complete in the background.
 *
 * @param promise - The promise to wrap
 * @param timeoutMs - Timeout in milliseconds
 * @param operation - Name of the operation (for error messages)
 * @returns The result of the promise if it resolves in time
 * @throws ChromeAPITimeoutError if the timeout is exceeded
 */
export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  operation: string,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new ChromeAPITimeoutError(operation, timeoutMs))
    }, timeoutMs)

    promise
      .then((result) => {
        clearTimeout(timer)
        resolve(result)
      })
      .catch((error) => {
        clearTimeout(timer)
        reject(error)
      })
  })
}

/**
 * Helper to get timeout value by key with fallback to DEFAULT
 */
export function getTimeout(key: TimeoutKey): number {
  return CHROME_API_TIMEOUTS[key] ?? CHROME_API_TIMEOUTS.DEFAULT
}
