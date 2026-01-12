/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Port binding utilities with retry logic for handling TIME_WAIT states.
 */

import { TIMEOUTS } from '@browseros/shared/constants/timeouts'
import { logger } from './logger'

export class PortBindError extends Error {
  constructor(
    public readonly port: number,
    public readonly originalError: Error,
    public readonly retriedFor: number,
  ) {
    super(
      `Failed to bind to port ${port} after ${retriedFor}ms: ${originalError.message}`,
    )
    this.name = 'PortBindError'
  }
}

function isPortInUseError(error: unknown): boolean {
  if (error instanceof Error) {
    const err = error as NodeJS.ErrnoException
    return err.code === 'EADDRINUSE'
  }
  return false
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Attempts to bind a port with retry logic.
 * Retries every 5 seconds for up to 30 seconds to handle TIME_WAIT states.
 *
 * @param port - The port to bind
 * @param bindFn - Function that attempts the bind (should throw on failure)
 * @throws PortBindError if binding fails after all retries
 */
export async function bindPortWithRetry<T>(
  port: number,
  bindFn: () => Promise<T>,
): Promise<T> {
  const startTime = Date.now()
  const maxDuration = TIMEOUTS.PORT_BIND_MAX_DURATION
  const retryInterval = TIMEOUTS.PORT_BIND_RETRY_INTERVAL
  let lastError = new Error('Port bind failed with no attempts')
  let attempt = 0

  do {
    attempt++
    try {
      const result = await bindFn()
      if (attempt > 1) {
        logger.info(`Port ${port} bound successfully after ${attempt} attempts`)
      }
      return result
    } catch (error) {
      if (!isPortInUseError(error)) {
        throw error
      }

      lastError = error as Error
      const elapsed = Date.now() - startTime
      const remaining = maxDuration - elapsed

      if (remaining <= 0) {
        break
      }

      logger.warn(
        `Port ${port} in use (attempt ${attempt}), retrying in ${retryInterval / 1000}s...`,
        { elapsed, remaining },
      )

      await sleep(Math.min(retryInterval, remaining))
    }
  } while (Date.now() - startTime < maxDuration)

  const totalTime = Date.now() - startTime
  throw new PortBindError(port, lastError, totalTime)
}
