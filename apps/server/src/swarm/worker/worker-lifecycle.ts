/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * WorkerLifecycleManager - Manages worker window lifecycle
 *
 * Handles spawning, monitoring, and terminating worker windows
 * for swarm execution.
 */

import { randomUUID } from 'node:crypto'
import type { ControllerBridge } from '../../browser/extension/bridge'
import { logger } from '../../lib/logger'
import { DEFAULT_RETRY_POLICY, SWARM_TIMEOUTS } from '../constants'
import type { SwarmRegistry } from '../coordinator/swarm-registry'
import type { SwarmMessagingBus } from '../messaging/swarm-bus'
import type { RetryPolicy, Worker, WorkerTask } from '../types'

interface WorkerHealthState {
  workerId: string
  swarmId: string
  lastHeartbeat: number
  lastProgress: number
  lastProgressTime: number
  heartbeatInterval?: NodeJS.Timeout
}

export class WorkerLifecycleManager {
  private healthStates = new Map<string, WorkerHealthState>()

  constructor(
    private bridge: ControllerBridge,
    private registry: SwarmRegistry,
    private messageBus: SwarmMessagingBus,
    private retryPolicy: RetryPolicy = DEFAULT_RETRY_POLICY,
  ) {}

  /**
   * Spawns a new worker window and registers it.
   */
  async spawnWorker(swarmId: string, task: WorkerTask): Promise<Worker> {
    const workerId = `worker-${randomUUID().slice(0, 8)}`

    logger.info('Spawning worker', {
      swarmId,
      workerId,
      taskId: task.id,
      startUrl: task.startUrl,
    })

    // Create worker record in pending state
    const worker: Worker = {
      id: workerId,
      swarmId,
      task,
      state: 'spawning',
      progress: 0,
      createdAt: Date.now(),
      retryCount: 0,
    }

    // Register worker in swarm
    this.registry.addWorker(swarmId, worker)

    try {
      // Create window via ControllerBridge (action name is camelCase: createWindow)
      const windowResult = await this.bridge.sendRequest('createWindow', {
        url: task.startUrl ?? 'about:blank',
        focused: false, // Workers run in background
        width: 1280,
        height: 800,
      })

      const result = windowResult as { windowId?: number }
      if (!result.windowId) {
        throw new Error('Failed to create worker window: no windowId returned')
      }

      worker.windowId = result.windowId
      worker.state = 'pending'
      worker.startedAt = Date.now()

      // Start health monitoring
      this.startHealthMonitoring(swarmId, workerId)

      logger.info('Worker window created', {
        swarmId,
        workerId,
        windowId: worker.windowId,
      })

      return worker
    } catch (error) {
      worker.state = 'failed'
      worker.error =
        error instanceof Error ? error.message : 'Failed to spawn worker'
      worker.completedAt = Date.now()

      logger.error('Failed to spawn worker', {
        swarmId,
        workerId,
        error: worker.error,
      })

      throw error
    }
  }

  /**
   * Starts health monitoring for a worker via heartbeats.
   */
  private startHealthMonitoring(swarmId: string, workerId: string): void {
    const healthState: WorkerHealthState = {
      workerId,
      swarmId,
      lastHeartbeat: Date.now(),
      lastProgress: 0,
      lastProgressTime: Date.now(),
    }

    // Subscribe to worker messages
    this.messageBus.subscribe(swarmId, 'master', (message) => {
      if (message.senderId !== workerId) return

      if (message.type === 'heartbeat') {
        healthState.lastHeartbeat = Date.now()
      }

      if (message.type === 'task_progress') {
        const payload = message.payload as { progress?: number }
        if (payload.progress !== undefined) {
          healthState.lastProgress = payload.progress
          healthState.lastProgressTime = Date.now()
        }
      }
    })

    // Start heartbeat checker
    healthState.heartbeatInterval = setInterval(() => {
      this.checkWorkerHealth(healthState)
    }, SWARM_TIMEOUTS.HEARTBEAT_INTERVAL_MS)

    this.healthStates.set(workerId, healthState)
  }

  /**
   * Checks worker health and handles failures.
   */
  private checkWorkerHealth(healthState: WorkerHealthState): void {
    const now = Date.now()
    const worker = this.registry.getWorker(
      healthState.swarmId,
      healthState.workerId,
    )

    if (!worker || worker.state === 'completed' || worker.state === 'failed') {
      // Worker is done, stop monitoring
      this.stopHealthMonitoring(healthState.workerId)
      return
    }

    // Check heartbeat timeout
    const heartbeatAge = now - healthState.lastHeartbeat
    if (heartbeatAge > SWARM_TIMEOUTS.HEARTBEAT_TIMEOUT_MS) {
      logger.warn('Worker heartbeat timeout', {
        swarmId: healthState.swarmId,
        workerId: healthState.workerId,
        lastHeartbeatAge: heartbeatAge,
      })

      this.handleWorkerFailure(
        healthState.swarmId,
        healthState.workerId,
        new Error('Heartbeat timeout'),
      )
      return
    }

    // Check progress stale
    if (worker.state === 'running') {
      const progressAge = now - healthState.lastProgressTime
      if (progressAge > SWARM_TIMEOUTS.PROGRESS_STALE_MS) {
        logger.warn('Worker progress stale', {
          swarmId: healthState.swarmId,
          workerId: healthState.workerId,
          lastProgressAge: progressAge,
        })

        // Don't fail immediately, just log warning
        // Could implement escalating intervention here
      }
    }
  }

  /**
   * Stops health monitoring for a worker.
   */
  private stopHealthMonitoring(workerId: string): void {
    const healthState = this.healthStates.get(workerId)
    if (healthState?.heartbeatInterval) {
      clearInterval(healthState.heartbeatInterval)
    }
    this.healthStates.delete(workerId)
  }

  /**
   * Handles a worker failure with retry logic.
   */
  async handleWorkerFailure(
    swarmId: string,
    workerId: string,
    error: Error,
  ): Promise<Worker | null> {
    const worker = this.registry.getWorker(swarmId, workerId)
    if (!worker) return null

    this.stopHealthMonitoring(workerId)

    // Check if we can retry
    if (worker.retryCount < this.retryPolicy.maxRetries) {
      logger.info('Retrying worker', {
        swarmId,
        workerId,
        retryCount: worker.retryCount + 1,
        maxRetries: this.retryPolicy.maxRetries,
      })

      // Calculate backoff delay
      const delay = Math.min(
        this.retryPolicy.baseDelayMs *
          this.retryPolicy.exponentialFactor ** worker.retryCount,
        this.retryPolicy.maxDelayMs,
      )

      await new Promise((resolve) => setTimeout(resolve, delay))

      // Terminate old window if it exists
      if (worker.windowId) {
        await this.terminateWorkerWindow(worker.windowId)
      }

      // Increment retry count and respawn
      const newRetryCount = worker.retryCount + 1
      worker.retryCount = newRetryCount
      worker.state = 'spawning'
      worker.windowId = undefined
      worker.error = undefined

      try {
        const newWorker = await this.spawnWorker(swarmId, worker.task)
        // Preserve retry count on the new worker
        newWorker.retryCount = newRetryCount
        return newWorker
      } catch (retryError) {
        logger.error('Worker retry failed', {
          swarmId,
          workerId,
          error: retryError,
        })
      }
    }

    // Max retries exceeded, mark as failed
    this.registry.setWorkerError(swarmId, workerId, error.message)

    logger.error('Worker failed permanently', {
      swarmId,
      workerId,
      retryCount: worker.retryCount,
      error: error.message,
    })

    return null
  }

  /**
   * Terminates a worker gracefully.
   */
  async terminateWorker(swarmId: string, workerId: string): Promise<void> {
    const worker = this.registry.getWorker(swarmId, workerId)
    if (!worker) return

    logger.info('Terminating worker', { swarmId, workerId })

    // Stop health monitoring
    this.stopHealthMonitoring(workerId)

    // Send terminate message
    this.messageBus.sendToWorker(swarmId, workerId, 'terminate', {
      reason: 'Terminated by coordinator',
    })

    // Close window
    if (worker.windowId) {
      await this.terminateWorkerWindow(worker.windowId)
    }

    // Update state
    this.registry.updateWorkerState(swarmId, workerId, 'terminated')
  }

  /**
   * Terminates a worker window.
   */
  private async terminateWorkerWindow(windowId: number): Promise<void> {
    try {
      await this.bridge.sendRequest('closeWindow', { windowId })
    } catch (error) {
      logger.warn('Failed to close worker window', {
        windowId,
        error,
      })
    }
  }

  /**
   * Terminates all workers in a swarm.
   */
  async terminateAllWorkers(swarmId: string): Promise<void> {
    const workers = this.registry.getWorkers(swarmId)

    logger.info('Terminating all workers', {
      swarmId,
      workerCount: workers.length,
    })

    // Broadcast terminate message
    this.messageBus.broadcast(swarmId, 'terminate', {
      reason: 'Swarm terminated',
    })

    // Terminate each worker
    await Promise.all(
      workers
        .filter((w) => w.state !== 'completed' && w.state !== 'failed')
        .map((w) => this.terminateWorker(swarmId, w.id)),
    )
  }

  /**
   * Gets the count of active workers.
   */
  getActiveWorkerCount(swarmId: string): number {
    const workers = this.registry.getWorkers(swarmId)
    return workers.filter(
      (w) =>
        w.state === 'pending' ||
        w.state === 'spawning' ||
        w.state === 'running',
    ).length
  }

  /**
   * Cleans up all health monitoring (for shutdown).
   */
  cleanup(): void {
    for (const [workerId] of this.healthStates) {
      this.stopHealthMonitoring(workerId)
    }
  }
}
