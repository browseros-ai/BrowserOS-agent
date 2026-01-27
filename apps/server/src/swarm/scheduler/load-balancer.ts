/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * LoadBalancer - Intelligent worker load distribution
 *
 * Implements multiple load balancing strategies with
 * real-time worker capacity tracking.
 */

import { EventEmitter } from 'node:events'
import { logger } from '../../lib/logger'
import type { Worker, WorkerTask } from '../types'
import type { ScheduledTask, TaskPriority } from './priority-queue'

export type LoadBalancingStrategy =
  | 'round-robin'
  | 'least-connections'
  | 'weighted'
  | 'resource-aware'
  | 'latency-based'

export interface WorkerCapacity {
  workerId: string
  windowId?: number
  /** Current number of active tasks */
  activeTaskCount: number
  /** Maximum concurrent tasks this worker can handle */
  maxTasks: number
  /** Current memory usage in MB */
  memoryUsageMb: number
  /** Memory limit in MB */
  memoryLimitMb: number
  /** CPU utilization 0-100 */
  cpuUtilization: number
  /** Average task completion time in ms */
  avgTaskDurationMs: number
  /** Number of completed tasks */
  completedTasks: number
  /** Number of failed tasks */
  failedTasks: number
  /** Worker health score 0-100 */
  healthScore: number
  /** Last updated timestamp */
  lastUpdated: number
  /** Is worker currently available */
  available: boolean
  /** Worker specializations (e.g., 'research', 'data-entry') */
  specializations: string[]
}

interface LoadBalancerConfig {
  strategy: LoadBalancingStrategy
  /** Enable sticky sessions for related tasks */
  stickySessionsEnabled: boolean
  /** Minimum health score to consider worker available */
  minHealthScore: number
  /** Maximum tasks per worker (0 = unlimited) */
  maxTasksPerWorker: number
  /** Weight configuration for weighted strategy */
  weights?: Record<string, number>
}

const DEFAULT_CONFIG: LoadBalancerConfig = {
  strategy: 'resource-aware',
  stickySessionsEnabled: true,
  minHealthScore: 50,
  maxTasksPerWorker: 3,
}

export class LoadBalancer extends EventEmitter {
  private workers = new Map<string, WorkerCapacity>()
  private roundRobinIndex = 0
  private stickyMapping = new Map<string, string>() // sessionId -> workerId
  private config: LoadBalancerConfig

  constructor(config: Partial<LoadBalancerConfig> = {}) {
    super()
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  /**
   * Registers a worker with initial capacity.
   */
  registerWorker(
    workerId: string,
    windowId?: number,
    specializations: string[] = [],
  ): void {
    const capacity: WorkerCapacity = {
      workerId,
      windowId,
      activeTaskCount: 0,
      maxTasks: this.config.maxTasksPerWorker,
      memoryUsageMb: 0,
      memoryLimitMb: 512,
      cpuUtilization: 0,
      avgTaskDurationMs: 0,
      completedTasks: 0,
      failedTasks: 0,
      healthScore: 100,
      lastUpdated: Date.now(),
      available: true,
      specializations,
    }

    this.workers.set(workerId, capacity)

    logger.debug('Worker registered with load balancer', {
      workerId,
      specializations,
    })

    this.emit('worker_registered', capacity)
  }

  /**
   * Unregisters a worker.
   */
  unregisterWorker(workerId: string): void {
    this.workers.delete(workerId)

    // Clean up sticky mappings
    for (const [sessionId, wId] of this.stickyMapping) {
      if (wId === workerId) {
        this.stickyMapping.delete(sessionId)
      }
    }

    this.emit('worker_unregistered', workerId)
  }

  /**
   * Selects the best worker for a task.
   */
  selectWorker(
    task: ScheduledTask | WorkerTask,
    sessionId?: string,
  ): WorkerCapacity | undefined {
    // Check sticky session first
    if (sessionId && this.config.stickySessionsEnabled) {
      const stickyWorkerId = this.stickyMapping.get(sessionId)
      if (stickyWorkerId) {
        const worker = this.workers.get(stickyWorkerId)
        if (worker && this.isWorkerAvailable(worker)) {
          return worker
        }
      }
    }

    const availableWorkers = this.getAvailableWorkers()

    if (availableWorkers.length === 0) {
      return undefined
    }

    let selected: WorkerCapacity | undefined

    switch (this.config.strategy) {
      case 'round-robin':
        selected = this.selectRoundRobin(availableWorkers)
        break

      case 'least-connections':
        selected = this.selectLeastConnections(availableWorkers)
        break

      case 'weighted':
        selected = this.selectWeighted(availableWorkers)
        break

      case 'resource-aware':
        selected = this.selectResourceAware(availableWorkers, task)
        break

      case 'latency-based':
        selected = this.selectLatencyBased(availableWorkers)
        break

      default:
        selected = availableWorkers[0]
    }

    // Set sticky mapping
    if (selected && sessionId && this.config.stickySessionsEnabled) {
      this.stickyMapping.set(sessionId, selected.workerId)
    }

    if (selected) {
      this.emit('worker_selected', { worker: selected, task })
    }

    return selected
  }

  /**
   * Round-robin selection.
   */
  private selectRoundRobin(workers: WorkerCapacity[]): WorkerCapacity {
    const worker = workers[this.roundRobinIndex % workers.length]
    this.roundRobinIndex = (this.roundRobinIndex + 1) % workers.length
    return worker
  }

  /**
   * Least connections selection.
   */
  private selectLeastConnections(workers: WorkerCapacity[]): WorkerCapacity {
    return workers.reduce((min, w) =>
      w.activeTaskCount < min.activeTaskCount ? w : min,
    )
  }

  /**
   * Weighted selection based on configured weights.
   */
  private selectWeighted(workers: WorkerCapacity[]): WorkerCapacity {
    const weights = this.config.weights ?? {}
    const totalWeight = workers.reduce(
      (sum, w) => sum + (weights[w.workerId] ?? 1),
      0,
    )

    let random = Math.random() * totalWeight
    for (const worker of workers) {
      const weight = weights[worker.workerId] ?? 1
      random -= weight
      if (random <= 0) {
        return worker
      }
    }

    return workers[0]
  }

  /**
   * Resource-aware selection considering memory, CPU, and task affinity.
   */
  private selectResourceAware(
    workers: WorkerCapacity[],
    task: ScheduledTask | WorkerTask,
  ): WorkerCapacity {
    const scored = workers.map((worker) => {
      let score = 100

      // Health score (0-100)
      score += worker.healthScore

      // Active tasks penalty
      score -= worker.activeTaskCount * 20

      // Memory usage penalty
      const memoryUsage = worker.memoryUsageMb / worker.memoryLimitMb
      score -= memoryUsage * 30

      // CPU utilization penalty
      score -= worker.cpuUtilization * 0.5

      // Success rate bonus
      const totalTasks = worker.completedTasks + worker.failedTasks
      if (totalTasks > 0) {
        const successRate = worker.completedTasks / totalTasks
        score += successRate * 20
      }

      // Latency bonus (faster workers preferred)
      if (worker.avgTaskDurationMs > 0) {
        // Normalize against 1 minute (lower is better)
        const latencyScore = Math.max(
          0,
          20 - (worker.avgTaskDurationMs / 60_000) * 20,
        )
        score += latencyScore
      }

      // Specialization bonus
      if ('instruction' in task) {
        const instruction = task.instruction.toLowerCase()
        for (const spec of worker.specializations) {
          if (instruction.includes(spec.toLowerCase())) {
            score += 30
          }
        }
      }

      return { worker, score }
    })

    scored.sort((a, b) => b.score - a.score)

    logger.debug('Resource-aware selection scores', {
      scores: scored.map((s) => ({
        workerId: s.worker.workerId,
        score: s.score.toFixed(2),
      })),
    })

    return scored[0].worker
  }

  /**
   * Latency-based selection (lowest average task duration).
   */
  private selectLatencyBased(workers: WorkerCapacity[]): WorkerCapacity {
    // Workers with no history get neutral score
    const withLatency = workers.map((w) => ({
      worker: w,
      latency: w.completedTasks > 0 ? w.avgTaskDurationMs : Infinity,
    }))

    withLatency.sort((a, b) => a.latency - b.latency)

    // If all have no history, fallback to least connections
    if (withLatency[0].latency === Infinity) {
      return this.selectLeastConnections(workers)
    }

    return withLatency[0].worker
  }

  /**
   * Checks if a worker is available for new tasks.
   */
  private isWorkerAvailable(worker: WorkerCapacity): boolean {
    if (!worker.available) return false
    if (worker.healthScore < this.config.minHealthScore) return false
    if (worker.activeTaskCount >= worker.maxTasks) return false
    return true
  }

  /**
   * Gets all available workers.
   */
  getAvailableWorkers(): WorkerCapacity[] {
    return Array.from(this.workers.values()).filter((w) =>
      this.isWorkerAvailable(w),
    )
  }

  /**
   * Updates worker capacity metrics.
   */
  updateCapacity(
    workerId: string,
    updates: Partial<Omit<WorkerCapacity, 'workerId' | 'windowId'>>,
  ): void {
    const worker = this.workers.get(workerId)
    if (!worker) return

    Object.assign(worker, updates, { lastUpdated: Date.now() })

    // Recalculate health score
    this.updateHealthScore(worker)

    this.emit('capacity_updated', worker)
  }

  /**
   * Records task assignment to worker.
   */
  recordTaskAssignment(workerId: string): void {
    const worker = this.workers.get(workerId)
    if (worker) {
      worker.activeTaskCount++
      worker.lastUpdated = Date.now()
    }
  }

  /**
   * Records task completion.
   */
  recordTaskCompletion(workerId: string, durationMs: number): void {
    const worker = this.workers.get(workerId)
    if (!worker) return

    worker.activeTaskCount = Math.max(0, worker.activeTaskCount - 1)
    worker.completedTasks++

    // Update rolling average task duration
    const totalTasks = worker.completedTasks
    worker.avgTaskDurationMs =
      (worker.avgTaskDurationMs * (totalTasks - 1) + durationMs) / totalTasks

    worker.lastUpdated = Date.now()
    this.updateHealthScore(worker)
  }

  /**
   * Records task failure.
   */
  recordTaskFailure(workerId: string): void {
    const worker = this.workers.get(workerId)
    if (!worker) return

    worker.activeTaskCount = Math.max(0, worker.activeTaskCount - 1)
    worker.failedTasks++
    worker.lastUpdated = Date.now()

    this.updateHealthScore(worker)
  }

  /**
   * Updates worker health score based on metrics.
   */
  private updateHealthScore(worker: WorkerCapacity): void {
    const totalTasks = worker.completedTasks + worker.failedTasks

    // Base score
    let score = 100

    // Success rate impact
    if (totalTasks > 0) {
      const successRate = worker.completedTasks / totalTasks
      score *= successRate
    }

    // Resource pressure impact
    const memoryPressure = worker.memoryUsageMb / worker.memoryLimitMb
    score -= memoryPressure * 20
    score -= worker.cpuUtilization * 0.2

    // Staleness penalty
    const staleMinutes = (Date.now() - worker.lastUpdated) / 60_000
    if (staleMinutes > 5) {
      score -= staleMinutes * 2
    }

    worker.healthScore = Math.max(0, Math.min(100, score))
  }

  /**
   * Sets worker availability.
   */
  setWorkerAvailability(workerId: string, available: boolean): void {
    const worker = this.workers.get(workerId)
    if (worker) {
      worker.available = available
      this.emit('availability_changed', { workerId, available })
    }
  }

  /**
   * Gets load balancer stats.
   */
  getStats(): {
    totalWorkers: number
    availableWorkers: number
    totalActiveTasks: number
    avgHealthScore: number
    strategy: LoadBalancingStrategy
  } {
    const allWorkers = Array.from(this.workers.values())
    const available = allWorkers.filter((w) => this.isWorkerAvailable(w))

    const totalActiveTasks = allWorkers.reduce(
      (sum, w) => sum + w.activeTaskCount,
      0,
    )

    const avgHealthScore =
      allWorkers.length > 0
        ? allWorkers.reduce((sum, w) => sum + w.healthScore, 0) /
          allWorkers.length
        : 0

    return {
      totalWorkers: allWorkers.length,
      availableWorkers: available.length,
      totalActiveTasks,
      avgHealthScore,
      strategy: this.config.strategy,
    }
  }

  /**
   * Gets worker capacity by ID.
   */
  getWorkerCapacity(workerId: string): WorkerCapacity | undefined {
    return this.workers.get(workerId)
  }

  /**
   * Sets load balancing strategy.
   */
  setStrategy(strategy: LoadBalancingStrategy): void {
    this.config.strategy = strategy
    this.emit('strategy_changed', strategy)
  }

  /**
   * Clears all workers.
   */
  clear(): void {
    this.workers.clear()
    this.stickyMapping.clear()
    this.roundRobinIndex = 0
  }
}
