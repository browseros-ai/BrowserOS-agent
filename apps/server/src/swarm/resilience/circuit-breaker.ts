/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * CircuitBreaker - Fault tolerance pattern implementation
 *
 * Prevents cascading failures by tracking error rates and
 * temporarily blocking calls when thresholds are exceeded.
 */

import { EventEmitter } from 'node:events'
import { logger } from '../../lib/logger'

export type CircuitState = 'closed' | 'open' | 'half-open'

export interface CircuitBreakerConfig {
  /** Name for logging/identification */
  name: string
  /** Number of failures before opening circuit */
  failureThreshold: number
  /** Number of successes to close circuit from half-open */
  successThreshold: number
  /** Time to wait before moving from open to half-open (ms) */
  resetTimeoutMs: number
  /** Time window for counting failures (ms) */
  failureWindowMs: number
  /** Maximum number of test requests in half-open state */
  halfOpenMaxCalls: number
  /** Optional fallback function */
  fallback?: () => Promise<unknown>
}

interface CircuitStats {
  state: CircuitState
  failures: number
  successes: number
  totalCalls: number
  lastFailure?: number
  lastSuccess?: number
  openedAt?: number
  consecutiveSuccesses: number
}

const DEFAULT_CONFIG: CircuitBreakerConfig = {
  name: 'default',
  failureThreshold: 5,
  successThreshold: 3,
  resetTimeoutMs: 30_000,
  failureWindowMs: 60_000,
  halfOpenMaxCalls: 3,
}

export class CircuitBreaker extends EventEmitter {
  private config: CircuitBreakerConfig
  private state: CircuitState = 'closed'
  private failureTimestamps: number[] = []
  private halfOpenCalls = 0
  private consecutiveSuccesses = 0
  private stats: CircuitStats

  constructor(config: Partial<CircuitBreakerConfig> = {}) {
    super()
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.stats = {
      state: 'closed',
      failures: 0,
      successes: 0,
      totalCalls: 0,
      consecutiveSuccesses: 0,
    }
  }

  /**
   * Executes a function with circuit breaker protection.
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    this.stats.totalCalls++

    // Check if circuit is open
    if (this.state === 'open') {
      if (this.shouldAttemptReset()) {
        this.transitionTo('half-open')
      } else {
        return this.handleOpenCircuit()
      }
    }

    // Check half-open limit
    if (this.state === 'half-open') {
      if (this.halfOpenCalls >= this.config.halfOpenMaxCalls) {
        return this.handleOpenCircuit()
      }
      this.halfOpenCalls++
    }

    try {
      const result = await fn()
      this.recordSuccess()
      return result
    } catch (error) {
      this.recordFailure(error)
      throw error
    }
  }

  /**
   * Wraps a function to automatically apply circuit breaker.
   */
  wrap<T, Args extends unknown[]>(
    fn: (...args: Args) => Promise<T>,
  ): (...args: Args) => Promise<T> {
    return (...args: Args) => this.execute(() => fn(...args))
  }

  /**
   * Records a successful call.
   */
  private recordSuccess(): void {
    this.stats.successes++
    this.stats.lastSuccess = Date.now()
    this.consecutiveSuccesses++

    if (this.state === 'half-open') {
      if (this.consecutiveSuccesses >= this.config.successThreshold) {
        this.transitionTo('closed')
      }
    }

    this.emit('success', this.getStats())
  }

  /**
   * Records a failed call.
   */
  private recordFailure(error: unknown): void {
    const now = Date.now()
    this.stats.failures++
    this.stats.lastFailure = now
    this.consecutiveSuccesses = 0

    // Add to failure window
    this.failureTimestamps.push(now)

    // Clean old failures outside window
    this.cleanFailureWindow()

    // Check if we should open the circuit
    if (this.state === 'half-open') {
      // Any failure in half-open returns to open
      this.transitionTo('open')
    } else if (this.state === 'closed') {
      if (this.failureTimestamps.length >= this.config.failureThreshold) {
        this.transitionTo('open')
      }
    }

    this.emit('failure', { error, stats: this.getStats() })
  }

  /**
   * Cleans failures outside the window.
   */
  private cleanFailureWindow(): void {
    const windowStart = Date.now() - this.config.failureWindowMs
    this.failureTimestamps = this.failureTimestamps.filter(
      (t) => t > windowStart,
    )
  }

  /**
   * Checks if we should attempt reset from open state.
   */
  private shouldAttemptReset(): boolean {
    if (!this.stats.openedAt) return false
    const elapsed = Date.now() - this.stats.openedAt
    return elapsed >= this.config.resetTimeoutMs
  }

  /**
   * Handles calls when circuit is open.
   */
  private async handleOpenCircuit<T>(): Promise<T> {
    const error = new CircuitOpenError(
      `Circuit breaker '${this.config.name}' is open`,
      this.getStats(),
    )

    if (this.config.fallback) {
      logger.debug('Circuit open, using fallback', { name: this.config.name })
      return this.config.fallback() as Promise<T>
    }

    this.emit('rejected', { error, stats: this.getStats() })
    throw error
  }

  /**
   * Transitions to a new state.
   */
  private transitionTo(newState: CircuitState): void {
    const previousState = this.state
    this.state = newState
    this.stats.state = newState

    logger.info('Circuit breaker state transition', {
      name: this.config.name,
      from: previousState,
      to: newState,
    })

    switch (newState) {
      case 'open':
        this.stats.openedAt = Date.now()
        this.halfOpenCalls = 0
        this.emit('open', this.getStats())
        break

      case 'half-open':
        this.halfOpenCalls = 0
        this.consecutiveSuccesses = 0
        this.emit('half-open', this.getStats())
        break

      case 'closed':
        this.failureTimestamps = []
        this.halfOpenCalls = 0
        this.stats.openedAt = undefined
        this.emit('closed', this.getStats())
        break
    }
  }

  /**
   * Gets current circuit state.
   */
  getState(): CircuitState {
    return this.state
  }

  /**
   * Gets circuit statistics.
   */
  getStats(): CircuitStats {
    return {
      ...this.stats,
      state: this.state,
      consecutiveSuccesses: this.consecutiveSuccesses,
    }
  }

  /**
   * Checks if circuit is allowing calls.
   */
  isAllowingCalls(): boolean {
    if (this.state === 'closed') return true
    if (this.state === 'half-open') {
      return this.halfOpenCalls < this.config.halfOpenMaxCalls
    }
    return this.shouldAttemptReset()
  }

  /**
   * Manually trips the circuit to open state.
   */
  trip(): void {
    if (this.state !== 'open') {
      this.transitionTo('open')
    }
  }

  /**
   * Manually resets the circuit to closed state.
   */
  reset(): void {
    this.transitionTo('closed')
  }

  /**
   * Forces half-open state for testing.
   */
  forceHalfOpen(): void {
    this.transitionTo('half-open')
  }
}

/**
 * Error thrown when circuit is open.
 */
export class CircuitOpenError extends Error {
  constructor(
    message: string,
    public readonly stats: CircuitStats,
  ) {
    super(message)
    this.name = 'CircuitOpenError'
  }
}

/**
 * Bulkhead pattern - limits concurrent executions.
 */
export class Bulkhead extends EventEmitter {
  private executing = 0
  private queue: Array<{
    resolve: (value: boolean) => void
    reject: (error: Error) => void
    enqueueTime: number
  }> = []

  constructor(
    private readonly maxConcurrent: number,
    private readonly maxQueue: number = 100,
    private readonly queueTimeoutMs: number = 30_000,
  ) {
    super()
  }

  /**
   * Acquires a slot for execution.
   */
  async acquire(): Promise<void> {
    if (this.executing < this.maxConcurrent) {
      this.executing++
      return
    }

    if (this.queue.length >= this.maxQueue) {
      throw new BulkheadFullError(
        `Bulkhead queue full (${this.maxQueue} waiting)`,
      )
    }

    // Wait in queue
    return new Promise((resolve, reject) => {
      const entry = {
        resolve: (acquired: boolean) => {
          if (acquired) {
            this.executing++
            resolve()
          } else {
            reject(new Error('Bulkhead slot not acquired'))
          }
        },
        reject,
        enqueueTime: Date.now(),
      }

      this.queue.push(entry)

      // Timeout
      setTimeout(() => {
        const index = this.queue.indexOf(entry)
        if (index !== -1) {
          this.queue.splice(index, 1)
          reject(new BulkheadTimeoutError('Bulkhead queue timeout'))
        }
      }, this.queueTimeoutMs)
    })
  }

  /**
   * Releases a slot after execution.
   */
  release(): void {
    this.executing = Math.max(0, this.executing - 1)

    // Process queue
    if (this.queue.length > 0) {
      const next = this.queue.shift()
      next?.resolve(true)
    }
  }

  /**
   * Executes a function with bulkhead protection.
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire()

    try {
      return await fn()
    } finally {
      this.release()
    }
  }

  /**
   * Gets current state.
   */
  getState(): {
    executing: number
    queued: number
    maxConcurrent: number
    maxQueue: number
  } {
    return {
      executing: this.executing,
      queued: this.queue.length,
      maxConcurrent: this.maxConcurrent,
      maxQueue: this.maxQueue,
    }
  }
}

export class BulkheadFullError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'BulkheadFullError'
  }
}

export class BulkheadTimeoutError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'BulkheadTimeoutError'
  }
}

/**
 * Retry with exponential backoff and jitter.
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number
    baseDelayMs?: number
    maxDelayMs?: number
    exponentialBase?: number
    jitter?: boolean
    shouldRetry?: (error: unknown, attempt: number) => boolean
    onRetry?: (error: unknown, attempt: number, delayMs: number) => void
  } = {},
): Promise<T> {
  const {
    maxRetries = 3,
    baseDelayMs = 1000,
    maxDelayMs = 30_000,
    exponentialBase = 2,
    jitter = true,
    shouldRetry = () => true,
    onRetry,
  } = options

  let lastError: unknown

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error

      if (attempt >= maxRetries || !shouldRetry(error, attempt)) {
        throw error
      }

      // Calculate delay with exponential backoff
      let delay = Math.min(
        baseDelayMs * exponentialBase ** attempt,
        maxDelayMs,
      )

      // Add jitter (±25%)
      if (jitter) {
        const jitterFactor = 0.75 + Math.random() * 0.5
        delay = Math.floor(delay * jitterFactor)
      }

      onRetry?.(error, attempt, delay)

      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }

  throw lastError
}

/**
 * Timeout wrapper for async functions.
 */
export async function withTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number,
  errorMessage = 'Operation timed out',
): Promise<T> {
  let timeoutId: NodeJS.Timeout

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new TimeoutError(errorMessage, timeoutMs))
    }, timeoutMs)
  })

  try {
    const result = await Promise.race([fn(), timeoutPromise])
    clearTimeout(timeoutId!)
    return result
  } catch (error) {
    clearTimeout(timeoutId!)
    throw error
  }
}

export class TimeoutError extends Error {
  constructor(
    message: string,
    public readonly timeoutMs: number,
  ) {
    super(message)
    this.name = 'TimeoutError'
  }
}
