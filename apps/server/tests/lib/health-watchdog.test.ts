/**
 * @license
 * Copyright 2025 BrowserOS
 */

import { afterEach, beforeEach, describe, it, mock, spyOn } from 'bun:test'
import assert from 'node:assert'

import { EXIT_CODES } from '@browseros/shared/constants/exit-codes'
import type { LoggerInterface } from '@browseros/shared/types/logger'

import { HealthWatchdog } from '../../src/lib/health-watchdog'

function createMockLogger(): LoggerInterface {
  return {
    debug: mock(() => {}),
    info: mock(() => {}),
    warn: mock(() => {}),
    error: mock(() => {}),
  }
}

describe('HealthWatchdog', () => {
  let mockLogger: LoggerInterface
  let exitSpy: ReturnType<typeof spyOn>
  let activeWatchdog: HealthWatchdog | null = null

  beforeEach(() => {
    mockLogger = createMockLogger()
    exitSpy = spyOn(process, 'exit').mockImplementation((() => {}) as never)
  })

  afterEach(() => {
    // Always stop watchdog to prevent timer leaks
    activeWatchdog?.stop()
    activeWatchdog = null
    exitSpy.mockRestore()
  })

  describe('constructor', () => {
    it('initializes with default timeout values', () => {
      activeWatchdog = new HealthWatchdog({ logger: mockLogger })

      // Should have a recent lastHealthCheckAt (within 100ms of now)
      const timeSinceLastCheck = activeWatchdog.getTimeSinceLastCheck()
      assert.ok(timeSinceLastCheck < 100, 'Initial time should be recent')
    })

    it('accepts custom timeout values', () => {
      activeWatchdog = new HealthWatchdog({
        logger: mockLogger,
        checkIntervalMs: 1000,
        timeoutMs: 5000,
      })

      // Watchdog created successfully with custom values
      assert.ok(activeWatchdog.getTimeSinceLastCheck() < 100)
    })
  })

  describe('recordHealthCheck', () => {
    it('resets the last health check timestamp', async () => {
      activeWatchdog = new HealthWatchdog({ logger: mockLogger })

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 50))

      const beforeRecord = activeWatchdog.getTimeSinceLastCheck()
      assert.ok(beforeRecord >= 45, 'Should have elapsed time')

      activeWatchdog.recordHealthCheck()

      const afterRecord = activeWatchdog.getTimeSinceLastCheck()
      assert.ok(afterRecord < 15, 'Should be reset to near-zero')
    })
  })

  describe('start/stop', () => {
    it('starts and stops the timer without error', () => {
      activeWatchdog = new HealthWatchdog({
        logger: mockLogger,
        checkIntervalMs: 10000, // Long interval to avoid triggering
        timeoutMs: 20000,
      })

      activeWatchdog.start()
      assert.ok(mockLogger.info, 'Should log start message')

      activeWatchdog.stop()
      // No error = success
    })

    it('start is idempotent', () => {
      activeWatchdog = new HealthWatchdog({
        logger: mockLogger,
        checkIntervalMs: 10000,
        timeoutMs: 20000,
      })

      activeWatchdog.start()
      activeWatchdog.start() // Should not create duplicate timers
      activeWatchdog.stop()
    })

    it('stop is idempotent', () => {
      activeWatchdog = new HealthWatchdog({
        logger: mockLogger,
        checkIntervalMs: 10000,
        timeoutMs: 20000,
      })

      activeWatchdog.start()
      activeWatchdog.stop()
      activeWatchdog.stop() // Should not error
    })
  })

  describe('timeout behavior', () => {
    it('calls process.exit when no health check within timeout', async () => {
      activeWatchdog = new HealthWatchdog({
        logger: mockLogger,
        checkIntervalMs: 10, // Check every 10ms
        timeoutMs: 30, // Timeout after 30ms
      })

      activeWatchdog.start()

      // Wait for timeout to trigger
      await new Promise((resolve) => setTimeout(resolve, 100))

      activeWatchdog.stop()

      // Verify exit was called with GENERAL_ERROR
      assert.ok(exitSpy.mock.calls.length > 0, 'process.exit should be called')
      assert.strictEqual(
        exitSpy.mock.calls[0][0],
        EXIT_CODES.GENERAL_ERROR,
        'Should exit with GENERAL_ERROR',
      )
    })

    it('does not exit when health checks are received', async () => {
      activeWatchdog = new HealthWatchdog({
        logger: mockLogger,
        checkIntervalMs: 20, // Check every 20ms
        timeoutMs: 50, // Timeout after 50ms
      })

      activeWatchdog.start()

      // Send health checks faster than timeout
      const interval = setInterval(() => {
        activeWatchdog?.recordHealthCheck()
      }, 15)

      // Wait longer than timeout
      await new Promise((resolve) => setTimeout(resolve, 120))

      clearInterval(interval)
      activeWatchdog.stop()

      // Should NOT have called exit
      assert.strictEqual(
        exitSpy.mock.calls.length,
        0,
        'process.exit should not be called when health checks are received',
      )
    })
  })

  describe('getTimeSinceLastCheck', () => {
    it('returns elapsed time since last health check', async () => {
      activeWatchdog = new HealthWatchdog({
        logger: mockLogger,
        checkIntervalMs: 10000, // Long interval to avoid triggering during test
        timeoutMs: 20000,
      })

      await new Promise((resolve) => setTimeout(resolve, 50))

      const elapsed = activeWatchdog.getTimeSinceLastCheck()
      assert.ok(elapsed >= 45, 'Should return at least 45ms')
      assert.ok(elapsed < 150, 'Should not be too much more than 50ms')
    })

    it('resets after recordHealthCheck', async () => {
      activeWatchdog = new HealthWatchdog({
        logger: mockLogger,
        checkIntervalMs: 10000, // Long interval to avoid triggering during test
        timeoutMs: 20000,
      })

      await new Promise((resolve) => setTimeout(resolve, 50))

      activeWatchdog.recordHealthCheck()

      const elapsed = activeWatchdog.getTimeSinceLastCheck()
      assert.ok(elapsed < 20, 'Should be near zero after recording')
    })
  })
})
