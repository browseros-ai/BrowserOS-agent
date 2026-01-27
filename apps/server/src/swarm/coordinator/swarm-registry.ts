/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * SwarmRegistry - Tracks active swarms and their workers
 *
 * Provides in-memory storage and lookup for swarm state.
 */

import { randomUUID } from 'node:crypto'
import { logger } from '../../lib/logger'
import { SWARM_LIMITS } from '../constants'
import type {
  Swarm,
  SwarmConfig,
  SwarmState,
  SwarmStatus,
  Worker,
  WorkerState,
} from '../types'

export class SwarmRegistry {
  private swarms = new Map<string, Swarm>()

  /**
   * Creates a new swarm and registers it.
   */
  create(task: string, config: SwarmConfig): Swarm {
    // Check concurrent swarm limit
    const activeSwarms = this.getActiveSwarms()
    if (activeSwarms.length >= SWARM_LIMITS.MAX_CONCURRENT_SWARMS) {
      throw new Error(
        `Maximum concurrent swarms (${SWARM_LIMITS.MAX_CONCURRENT_SWARMS}) reached`,
      )
    }

    const swarm: Swarm = {
      id: randomUUID(),
      task,
      state: 'planning',
      config,
      workers: new Map(),
      createdAt: Date.now(),
    }

    this.swarms.set(swarm.id, swarm)

    logger.info('Swarm created', {
      swarmId: swarm.id,
      task: task.slice(0, 100),
      maxWorkers: config.maxWorkers,
    })

    return swarm
  }

  /**
   * Gets a swarm by ID.
   */
  get(swarmId: string): Swarm | undefined {
    return this.swarms.get(swarmId)
  }

  /**
   * Gets a swarm by ID, throws if not found.
   */
  getOrThrow(swarmId: string): Swarm {
    const swarm = this.swarms.get(swarmId)
    if (!swarm) {
      throw new Error(`Swarm not found: ${swarmId}`)
    }
    return swarm
  }

  /**
   * Updates swarm state.
   */
  updateState(swarmId: string, state: SwarmState): void {
    const swarm = this.getOrThrow(swarmId)
    const previousState = swarm.state
    swarm.state = state

    if (state === 'executing' && !swarm.startedAt) {
      swarm.startedAt = Date.now()
    }

    if (state === 'completed' || state === 'failed' || state === 'cancelled') {
      swarm.completedAt = Date.now()
    }

    logger.info('Swarm state updated', {
      swarmId,
      previousState,
      newState: state,
    })
  }

  /**
   * Adds a worker to a swarm.
   */
  addWorker(swarmId: string, worker: Worker): void {
    const swarm = this.getOrThrow(swarmId)

    if (swarm.workers.size >= swarm.config.maxWorkers) {
      throw new Error(
        `Swarm ${swarmId} has reached max workers (${swarm.config.maxWorkers})`,
      )
    }

    swarm.workers.set(worker.id, worker)

    logger.debug('Worker added to swarm', {
      swarmId,
      workerId: worker.id,
      totalWorkers: swarm.workers.size,
    })
  }

  /**
   * Gets a worker by ID.
   */
  getWorker(swarmId: string, workerId: string): Worker | undefined {
    const swarm = this.swarms.get(swarmId)
    return swarm?.workers.get(workerId)
  }

  /**
   * Updates a worker's state.
   */
  updateWorkerState(
    swarmId: string,
    workerId: string,
    state: WorkerState,
  ): void {
    const worker = this.getWorker(swarmId, workerId)
    if (!worker) {
      throw new Error(`Worker not found: ${workerId} in swarm ${swarmId}`)
    }

    const previousState = worker.state
    worker.state = state

    if (state === 'running' && !worker.startedAt) {
      worker.startedAt = Date.now()
    }

    if (state === 'completed' || state === 'failed' || state === 'terminated') {
      worker.completedAt = Date.now()
    }

    logger.debug('Worker state updated', {
      swarmId,
      workerId,
      previousState,
      newState: state,
    })
  }

  /**
   * Updates a worker's progress.
   */
  updateWorkerProgress(
    swarmId: string,
    workerId: string,
    progress: number,
    currentAction?: string,
  ): void {
    const worker = this.getWorker(swarmId, workerId)
    if (!worker) return

    worker.progress = Math.min(100, Math.max(0, progress))
    if (currentAction) {
      worker.currentAction = currentAction
    }
  }

  /**
   * Sets a worker's result.
   */
  setWorkerResult(
    swarmId: string,
    workerId: string,
    result: unknown,
    metrics?: Worker['metrics'],
  ): void {
    const worker = this.getWorker(swarmId, workerId)
    if (!worker) return

    worker.result = result
    worker.metrics = metrics
    worker.state = 'completed'
    worker.completedAt = Date.now()
    worker.progress = 100
  }

  /**
   * Sets a worker's error.
   */
  setWorkerError(swarmId: string, workerId: string, error: string): void {
    const worker = this.getWorker(swarmId, workerId)
    if (!worker) return

    worker.error = error
    worker.state = 'failed'
    worker.completedAt = Date.now()
  }

  /**
   * Gets all workers in a swarm.
   */
  getWorkers(swarmId: string): Worker[] {
    const swarm = this.swarms.get(swarmId)
    return swarm ? Array.from(swarm.workers.values()) : []
  }

  /**
   * Gets swarm status summary.
   */
  getStatus(swarmId: string): SwarmStatus | undefined {
    const swarm = this.swarms.get(swarmId)
    if (!swarm) return undefined

    const workers = Array.from(swarm.workers.values())
    const workerCounts = {
      total: workers.length,
      pending: workers.filter((w) => w.state === 'pending').length,
      running: workers.filter(
        (w) => w.state === 'running' || w.state === 'spawning',
      ).length,
      completed: workers.filter((w) => w.state === 'completed').length,
      failed: workers.filter(
        (w) => w.state === 'failed' || w.state === 'terminated',
      ).length,
    }

    // Calculate overall progress
    const totalProgress =
      workers.length > 0
        ? workers.reduce((sum, w) => sum + w.progress, 0) / workers.length
        : 0

    return {
      swarmId: swarm.id,
      state: swarm.state,
      progress: Math.round(totalProgress),
      startedAt: swarm.startedAt ?? swarm.createdAt,
      completedAt: swarm.completedAt,
      workers: workerCounts,
      error: swarm.error,
    }
  }

  /**
   * Gets all active (non-terminal) swarms.
   */
  getActiveSwarms(): Swarm[] {
    return Array.from(this.swarms.values()).filter(
      (s) =>
        s.state !== 'completed' &&
        s.state !== 'failed' &&
        s.state !== 'cancelled',
    )
  }

  /**
   * Deletes a swarm from the registry.
   */
  delete(swarmId: string): boolean {
    const deleted = this.swarms.delete(swarmId)
    if (deleted) {
      logger.info('Swarm deleted from registry', { swarmId })
    }
    return deleted
  }

  /**
   * Gets the total count of swarms.
   */
  count(): number {
    return this.swarms.size
  }

  /**
   * Clears all swarms (for testing).
   */
  clear(): void {
    this.swarms.clear()
  }
}
