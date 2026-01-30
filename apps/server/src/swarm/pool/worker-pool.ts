/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * WorkerPool - Resource pooling for worker agents
 *
 * Maintains a pool of pre-warmed worker windows for faster
 * task execution with automatic scaling.
 */

import { randomUUID } from 'node:crypto'
import { EventEmitter } from 'node:events'
import type { ControllerBridge } from '../../browser/extension/bridge'
import { logger } from '../../lib/logger'
import type { WorkerTask } from '../types'

export interface PooledWorker {
  id: string
  windowId: number
  state: 'idle' | 'warm' | 'busy' | 'draining' | 'terminated'
  createdAt: number
  lastUsedAt: number
  taskCount: number
  currentTask?: WorkerTask
  /** Time spent initializing (warm-up) */
  warmupTimeMs: number
  /** Memory usage estimate */
  memoryMb: number
}

export interface WorkerPoolConfig {
  /** Minimum workers to keep warm */
  minWorkers: number
  /** Maximum workers in pool */
  maxWorkers: number
  /** Time before idle worker is terminated (ms) */
  idleTimeoutMs: number
  /** Time to wait for worker to warm up (ms) */
  warmupTimeoutMs: number
  /** Target percentage of pool to keep warm (0-1) */
  warmPoolRatio: number
  /** Initial URL for warm workers */
  warmupUrl: string
  /** Enable auto-scaling */
  autoScale: boolean
  /** Scale up when utilization exceeds this (0-1) */
  scaleUpThreshold: number
  /** Scale down when utilization below this (0-1) */
  scaleDownThreshold: number
  /** Cooldown between scaling operations (ms) */
  scaleCooldownMs: number
}

const DEFAULT_CONFIG: WorkerPoolConfig = {
  minWorkers: 2,
  maxWorkers: 10,
  idleTimeoutMs: 300_000, // 5 minutes
  warmupTimeoutMs: 10_000,
  warmPoolRatio: 0.5,
  warmupUrl: 'about:blank',
  autoScale: true,
  scaleUpThreshold: 0.8,
  scaleDownThreshold: 0.2,
  scaleCooldownMs: 30_000,
}

export class WorkerPool extends EventEmitter {
  private workers = new Map<string, PooledWorker>()
  private config: WorkerPoolConfig
  private maintenanceInterval?: NodeJS.Timeout
  private lastScaleTime = 0
  private initializing = false

  constructor(
    private bridge: ControllerBridge,
    config: Partial<WorkerPoolConfig> = {},
  ) {
    super()
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  /**
   * Initializes the pool with minimum workers.
   * Defers pre-warming until extension is connected to avoid blocking startup.
   */
  async initialize(): Promise<void> {
    if (this.initializing) return
    this.initializing = true

    logger.info('Initializing worker pool', {
      minWorkers: this.config.minWorkers,
      maxWorkers: this.config.maxWorkers,
    })

    try {
      // Start maintenance loop (handles pre-warming when extension connects)
      this.startMaintenance()

      // Pre-warm workers in background (don't block server startup)
      // Workers will be created on-demand if not available
      this.warmWorkersInBackground().catch((err) => {
        logger.debug(
          'Background worker warmup skipped (extension not connected)',
          {
            error: err instanceof Error ? err.message : String(err),
          },
        )
      })

      logger.info('Worker pool initialized (pre-warming in background)', {
        maxWorkers: this.config.maxWorkers,
      })
    } finally {
      this.initializing = false
    }

    this.emit('initialized', this.getStats())
  }

  /**
   * Pre-warms workers in background without blocking.
   */
  private async warmWorkersInBackground(): Promise<void> {
    // Small delay to let extension connect
    await new Promise((resolve) => setTimeout(resolve, 2000))

    const warmupPromises: Promise<void>[] = []
    for (let i = 0; i < this.config.minWorkers; i++) {
      warmupPromises.push(
        this.warmWorker().catch(() => {
          // Ignore individual warmup failures
        }),
      )
    }

    await Promise.allSettled(warmupPromises)
    logger.debug('Background warmup complete', {
      warmWorkers: this.getIdleCount(),
    })
  }

  /**
   * Acquires a worker from the pool.
   */
  async acquire(task: WorkerTask): Promise<PooledWorker> {
    // Try to get an idle worker first
    let worker = this.getIdleWorker()

    if (!worker) {
      // Check if we can scale up
      if (this.workers.size < this.config.maxWorkers) {
        worker = await this.createWorker()
      } else {
        // Wait for a worker to become available
        worker = await this.waitForWorker()
      }
    }

    // Assign task
    worker.state = 'busy'
    worker.currentTask = task
    worker.lastUsedAt = Date.now()
    worker.taskCount++

    logger.debug('Worker acquired from pool', {
      workerId: worker.id,
      windowId: worker.windowId,
      taskId: task.id,
    })

    this.emit('worker_acquired', worker)

    return worker
  }

  /**
   * Releases a worker back to the pool.
   */
  release(workerId: string): void {
    const worker = this.workers.get(workerId)
    if (!worker) return

    worker.state = 'idle'
    worker.currentTask = undefined
    worker.lastUsedAt = Date.now()

    logger.debug('Worker released to pool', {
      workerId: worker.id,
      taskCount: worker.taskCount,
    })

    this.emit('worker_released', worker)

    // Trigger auto-scale check
    if (this.config.autoScale) {
      this.checkAutoScale()
    }
  }

  /**
   * Creates a new worker window.
   */
  private async createWorker(): Promise<PooledWorker> {
    const startTime = Date.now()
    const workerId = `pool-worker-${randomUUID().slice(0, 8)}`

    logger.debug('Creating pool worker', { workerId })

    const result = await this.bridge.sendRequest('createWindow', {
      url: this.config.warmupUrl,
      focused: false,
      width: 1280,
      height: 800,
    })

    const windowResult = result as { windowId?: number }
    if (!windowResult.windowId) {
      throw new Error('Failed to create worker window')
    }

    const worker: PooledWorker = {
      id: workerId,
      windowId: windowResult.windowId,
      state: 'idle',
      createdAt: Date.now(),
      lastUsedAt: Date.now(),
      taskCount: 0,
      warmupTimeMs: Date.now() - startTime,
      memoryMb: 0,
    }

    this.workers.set(workerId, worker)

    logger.info('Pool worker created', {
      workerId,
      windowId: worker.windowId,
      warmupTimeMs: worker.warmupTimeMs,
    })

    this.emit('worker_created', worker)

    return worker
  }

  /**
   * Warms up a worker (creates without assigning task).
   */
  private async warmWorker(): Promise<void> {
    try {
      const worker = await this.createWorker()
      worker.state = 'warm'
    } catch (error) {
      logger.error('Failed to warm worker', { error })
    }
  }

  /**
   * Gets an idle worker from the pool.
   */
  private getIdleWorker(): PooledWorker | undefined {
    for (const worker of this.workers.values()) {
      if (worker.state === 'idle' || worker.state === 'warm') {
        return worker
      }
    }
    return undefined
  }

  /**
   * Waits for a worker to become available.
   */
  private waitForWorker(): Promise<PooledWorker> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.off('worker_released', handler)
        reject(new Error('Timeout waiting for worker'))
      }, this.config.warmupTimeoutMs)

      const handler = (worker: PooledWorker) => {
        clearTimeout(timeout)
        this.off('worker_released', handler)
        resolve(worker)
      }

      this.on('worker_released', handler)
    })
  }

  /**
   * Terminates a worker.
   */
  async terminate(workerId: string): Promise<void> {
    const worker = this.workers.get(workerId)
    if (!worker) return

    worker.state = 'draining'

    try {
      await this.bridge.sendRequest('closeWindow', {
        windowId: worker.windowId,
      })
    } catch (error) {
      logger.warn('Error closing worker window', { workerId, error })
    }

    worker.state = 'terminated'
    this.workers.delete(workerId)

    logger.info('Pool worker terminated', {
      workerId,
      totalTasks: worker.taskCount,
    })

    this.emit('worker_terminated', worker)
  }

  /**
   * Starts the maintenance loop.
   */
  private startMaintenance(): void {
    if (this.maintenanceInterval) return

    this.maintenanceInterval = setInterval(() => {
      this.runMaintenance()
    }, 30_000) // Every 30 seconds
  }

  /**
   * Runs maintenance tasks.
   */
  private async runMaintenance(): Promise<void> {
    const now = Date.now()

    // Terminate idle workers past timeout
    for (const worker of this.workers.values()) {
      if (worker.state === 'idle' || worker.state === 'warm') {
        const idleTime = now - worker.lastUsedAt

        // Keep minimum workers
        if (this.workers.size <= this.config.minWorkers) {
          continue
        }

        if (idleTime > this.config.idleTimeoutMs) {
          logger.debug('Terminating idle worker', {
            workerId: worker.id,
            idleTimeMs: idleTime,
          })
          await this.terminate(worker.id)
        }
      }
    }

    // Ensure minimum warm workers
    const warmCount = this.getWarmCount()
    const targetWarm = Math.ceil(
      this.config.maxWorkers * this.config.warmPoolRatio,
    )

    if (warmCount < targetWarm && this.workers.size < this.config.maxWorkers) {
      const toWarm = Math.min(
        targetWarm - warmCount,
        this.config.maxWorkers - this.workers.size,
      )

      for (let i = 0; i < toWarm; i++) {
        this.warmWorker().catch(() => {})
      }
    }

    this.emit('maintenance_complete', this.getStats())
  }

  /**
   * Checks and performs auto-scaling.
   */
  private async checkAutoScale(): Promise<void> {
    if (!this.config.autoScale) return

    const now = Date.now()
    if (now - this.lastScaleTime < this.config.scaleCooldownMs) {
      return // Still in cooldown
    }

    const utilization = this.getUtilization()

    if (
      utilization > this.config.scaleUpThreshold &&
      this.workers.size < this.config.maxWorkers
    ) {
      // Scale up
      logger.info('Auto-scaling up worker pool', {
        utilization,
        currentSize: this.workers.size,
      })

      this.lastScaleTime = now
      await this.warmWorker()

      this.emit('scaled_up', this.getStats())
    } else if (
      utilization < this.config.scaleDownThreshold &&
      this.workers.size > this.config.minWorkers
    ) {
      // Scale down (terminate an idle worker)
      const idleWorker = this.getIdleWorker()
      if (idleWorker) {
        logger.info('Auto-scaling down worker pool', {
          utilization,
          currentSize: this.workers.size,
        })

        this.lastScaleTime = now
        await this.terminate(idleWorker.id)

        this.emit('scaled_down', this.getStats())
      }
    }
  }

  /**
   * Gets pool utilization (0-1).
   */
  getUtilization(): number {
    if (this.workers.size === 0) return 0

    const busy = Array.from(this.workers.values()).filter(
      (w) => w.state === 'busy',
    ).length

    return busy / this.workers.size
  }

  /**
   * Gets count of idle workers.
   */
  getIdleCount(): number {
    return Array.from(this.workers.values()).filter(
      (w) => w.state === 'idle' || w.state === 'warm',
    ).length
  }

  /**
   * Gets count of warm workers.
   */
  getWarmCount(): number {
    return Array.from(this.workers.values()).filter((w) => w.state === 'warm')
      .length
  }

  /**
   * Gets pool statistics.
   */
  getStats(): {
    totalWorkers: number
    idleWorkers: number
    busyWorkers: number
    warmWorkers: number
    utilization: number
    avgWarmupTimeMs: number
    totalTasksProcessed: number
  } {
    const all = Array.from(this.workers.values())

    const idle = all.filter(
      (w) => w.state === 'idle' || w.state === 'warm',
    ).length
    const busy = all.filter((w) => w.state === 'busy').length
    const warm = all.filter((w) => w.state === 'warm').length

    const totalWarmupTime = all.reduce((sum, w) => sum + w.warmupTimeMs, 0)
    const totalTasks = all.reduce((sum, w) => sum + w.taskCount, 0)

    return {
      totalWorkers: all.length,
      idleWorkers: idle,
      busyWorkers: busy,
      warmWorkers: warm,
      utilization: this.getUtilization(),
      avgWarmupTimeMs: all.length > 0 ? totalWarmupTime / all.length : 0,
      totalTasksProcessed: totalTasks,
    }
  }

  /**
   * Gets all workers.
   */
  getAllWorkers(): PooledWorker[] {
    return Array.from(this.workers.values())
  }

  /**
   * Gets a worker by ID.
   */
  getWorker(workerId: string): PooledWorker | undefined {
    return this.workers.get(workerId)
  }

  /**
   * Drains the pool (stop accepting new tasks, finish existing).
   */
  async drain(): Promise<void> {
    logger.info('Draining worker pool')

    // Mark all idle workers for termination
    for (const worker of this.workers.values()) {
      if (worker.state === 'idle' || worker.state === 'warm') {
        worker.state = 'draining'
      }
    }

    // Wait for busy workers to complete
    const busyWorkers = Array.from(this.workers.values()).filter(
      (w) => w.state === 'busy',
    )

    if (busyWorkers.length > 0) {
      await new Promise<void>((resolve) => {
        const check = () => {
          const stillBusy = Array.from(this.workers.values()).filter(
            (w) => w.state === 'busy',
          ).length

          if (stillBusy === 0) {
            resolve()
          } else {
            setTimeout(check, 1000)
          }
        }
        check()
      })
    }

    // Terminate all workers
    await this.shutdown()
  }

  /**
   * Shuts down the pool immediately.
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down worker pool')

    if (this.maintenanceInterval) {
      clearInterval(this.maintenanceInterval)
      this.maintenanceInterval = undefined
    }

    const terminatePromises = Array.from(this.workers.keys()).map((id) =>
      this.terminate(id),
    )

    await Promise.all(terminatePromises)

    this.emit('shutdown')
  }
}
