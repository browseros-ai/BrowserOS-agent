/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

/**
 * Timeout configuration for Chrome API and BrowserOS operations.
 * These prevent hung APIs from blocking the mutex indefinitely.
 */
export const CHROME_API_TIMEOUTS = {
  /** Quick Chrome API calls (tabs, bookmarks, history queries) */
  CHROME_API: 15_000,

  /** BrowserOS page actions (click, scroll, input, etc.) */
  BROWSEROS_ACTION: 10_000,

  /** Heavy BrowserOS operations (screenshot, snapshot, accessibility tree) */
  BROWSEROS_HEAVY: 60_000,
} as const

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
