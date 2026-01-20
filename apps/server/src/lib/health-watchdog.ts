/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Health Watchdog
 *
 * Self-terminates the server if no health checks are received from Chromium
 * within the timeout period. This prevents orphaned server processes when
 * Chrome crashes or multiple server instances exist.
 *
 * Only enabled when launched by Chrome (instanceInstallId present).
 * In dev mode, the watchdog is disabled.
 */

import { EXIT_CODES } from '@browseros/shared/constants/exit-codes'
import { TIMEOUTS } from '@browseros/shared/constants/timeouts'
import type { LoggerInterface } from '@browseros/shared/types/logger'

export interface HealthWatchdogConfig {
  logger: LoggerInterface
  checkIntervalMs?: number
  timeoutMs?: number
}

export class HealthWatchdog {
  private lastHealthCheckAt: number
  private timer: ReturnType<typeof setInterval> | null = null
  private readonly logger: LoggerInterface
  private readonly checkIntervalMs: number
  private readonly timeoutMs: number

  constructor(config: HealthWatchdogConfig) {
    this.logger = config.logger
    this.checkIntervalMs =
      config.checkIntervalMs ?? TIMEOUTS.HEALTH_WATCHDOG_CHECK_INTERVAL
    this.timeoutMs = config.timeoutMs ?? TIMEOUTS.HEALTH_WATCHDOG_TIMEOUT
    this.lastHealthCheckAt = Date.now()
  }

  /**
   * Start the watchdog timer.
   * Call this after the HTTP server is ready.
   */
  start(): void {
    if (this.timer) {
      return
    }

    this.logger.info('Health watchdog started', {
      checkIntervalMs: this.checkIntervalMs,
      timeoutMs: this.timeoutMs,
    })

    this.timer = setInterval(() => this.check(), this.checkIntervalMs)
  }

  /**
   * Stop the watchdog timer.
   * Call this during graceful shutdown.
   */
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
      this.logger.info('Health watchdog stopped')
    }
  }

  /**
   * Record that a health check was received.
   * Call this from the /health endpoint handler.
   */
  recordHealthCheck(): void {
    this.lastHealthCheckAt = Date.now()
  }

  /**
   * Check if health checks have been received within the timeout.
   * If not, self-terminate with GENERAL_ERROR so Chrome restarts us
   * (if Chrome is still alive) or we just die (if orphaned).
   */
  private check(): void {
    const elapsed = Date.now() - this.lastHealthCheckAt

    if (elapsed > this.timeoutMs) {
      this.logger.warn(
        'No health checks received within timeout, self-terminating',
        {
          elapsedMs: elapsed,
          timeoutMs: this.timeoutMs,
        },
      )
      process.exit(EXIT_CODES.GENERAL_ERROR)
    }
  }

  /**
   * Get time since last health check (for debugging/monitoring).
   */
  getTimeSinceLastCheck(): number {
    return Date.now() - this.lastHealthCheckAt
  }
}
