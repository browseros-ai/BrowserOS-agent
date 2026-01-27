/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * SwarmCoordinator - Main orchestrator for swarm execution
 *
 * Coordinates the entire swarm lifecycle: planning, spawning workers,
 * monitoring execution, and aggregating results.
 */

import { EventEmitter } from 'node:events'
import type { ControllerBridge } from '../../browser/extension/bridge'
import { logger } from '../../lib/logger'
import { DEFAULT_SWARM_CONFIG, SWARM_TIMEOUTS } from '../constants'
import type { SwarmRegistry } from './swarm-registry'
import type { TaskPlanner, LLMProvider } from './task-planner'
import type { WorkerLifecycleManager } from '../worker/worker-lifecycle'
import type { SwarmMessagingBus } from '../messaging/swarm-bus'
import type { ResultAggregator } from '../aggregation/result-aggregator'
import type {
  Swarm,
  SwarmConfig,
  SwarmRequest,
  SwarmResult,
  SwarmStatus,
  WorkerTask,
} from '../types'

export interface SwarmCoordinatorDeps {
  bridge: ControllerBridge
  registry: SwarmRegistry
  taskPlanner: TaskPlanner
  lifecycle: WorkerLifecycleManager
  messageBus: SwarmMessagingBus
  aggregator: ResultAggregator
}

export type SwarmEvent =
  | { type: 'swarm_started'; swarmId: string; workerCount: number }
  | { type: 'worker_spawned'; swarmId: string; workerId: string; taskId: string }
  | { type: 'worker_progress'; swarmId: string; workerId: string; progress: number }
  | { type: 'worker_completed'; swarmId: string; workerId: string }
  | { type: 'worker_failed'; swarmId: string; workerId: string; error: string }
  | { type: 'aggregation_started'; swarmId: string }
  | { type: 'swarm_completed'; swarmId: string; result: SwarmResult }
  | { type: 'swarm_failed'; swarmId: string; error: string }

export class SwarmCoordinator extends EventEmitter {
  private deps: SwarmCoordinatorDeps
  private config: SwarmConfig

  constructor(deps: SwarmCoordinatorDeps, config: Partial<SwarmConfig> = {}) {
    super()
    this.deps = deps
    this.config = { ...DEFAULT_SWARM_CONFIG, ...config }
  }

  /**
   * Creates a new swarm from a request.
   */
  async createSwarm(request: SwarmRequest): Promise<Swarm> {
    logger.info('Creating swarm', {
      task: request.task.slice(0, 100),
      maxWorkers: request.maxWorkers,
    })

    const config: SwarmConfig = {
      ...this.config,
      maxWorkers: request.maxWorkers ?? this.config.maxWorkers,
      swarmTimeoutMs: request.timeoutMs ?? this.config.swarmTimeoutMs,
    }

    const swarm = this.deps.registry.create(request.task, config)

    return swarm
  }

  /**
   * Executes a swarm: decomposes task, spawns workers, monitors, aggregates.
   */
  async executeSwarm(
    swarmId: string,
    options: { outputFormat?: 'json' | 'markdown' | 'html' } = {},
  ): Promise<SwarmResult> {
    const swarm = this.deps.registry.getOrThrow(swarmId)
    const outputFormat = options.outputFormat ?? 'markdown'

    try {
      // Phase 1: Decompose task
      this.deps.registry.updateState(swarmId, 'planning')
      const tasks = await this.decomposeTasks(swarm)

      // Phase 2: Spawn workers
      this.deps.registry.updateState(swarmId, 'spawning')
      await this.spawnWorkers(swarmId, tasks)

      this.emit('event', {
        type: 'swarm_started',
        swarmId,
        workerCount: tasks.length,
      } satisfies SwarmEvent)

      // Phase 3: Execute and monitor
      this.deps.registry.updateState(swarmId, 'executing')
      await this.monitorExecution(swarmId)

      // Phase 4: Aggregate results
      this.deps.registry.updateState(swarmId, 'aggregating')
      this.emit('event', {
        type: 'aggregation_started',
        swarmId,
      } satisfies SwarmEvent)

      const aggregated = await this.deps.aggregator.aggregate(
        swarmId,
        outputFormat,
      )

      // Mark completed
      this.deps.registry.updateState(swarmId, 'completed')

      const result: SwarmResult = {
        swarmId,
        partial: aggregated.partial,
        warnings: aggregated.warnings,
        result: aggregated.result,
        metrics: aggregated.metrics,
      }

      swarm.result = result

      this.emit('event', {
        type: 'swarm_completed',
        swarmId,
        result,
      } satisfies SwarmEvent)

      logger.info('Swarm completed', {
        swarmId,
        partial: result.partial,
        duration: result.metrics.totalDurationMs,
      })

      return result
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'

      this.deps.registry.updateState(swarmId, 'failed')
      swarm.error = errorMessage

      this.emit('event', {
        type: 'swarm_failed',
        swarmId,
        error: errorMessage,
      } satisfies SwarmEvent)

      logger.error('Swarm failed', { swarmId, error: errorMessage })

      // Cleanup workers
      await this.deps.lifecycle.terminateAllWorkers(swarmId)

      throw error
    }
  }

  /**
   * Creates and executes a swarm in one call.
   */
  async createAndExecute(
    request: SwarmRequest,
    options: { outputFormat?: 'json' | 'markdown' | 'html' } = {},
  ): Promise<SwarmResult> {
    const swarm = await this.createSwarm(request)
    return this.executeSwarm(swarm.id, options)
  }

  /**
   * Terminates a running swarm.
   */
  async terminateSwarm(swarmId: string): Promise<void> {
    logger.info('Terminating swarm', { swarmId })

    await this.deps.lifecycle.terminateAllWorkers(swarmId)
    this.deps.messageBus.removeSwarmListeners(swarmId)
    this.deps.registry.updateState(swarmId, 'cancelled')
  }

  /**
   * Gets current swarm status.
   */
  getStatus(swarmId: string): SwarmStatus | undefined {
    return this.deps.registry.getStatus(swarmId)
  }

  /**
   * Decomposes the task into worker tasks.
   */
  private async decomposeTasks(swarm: Swarm): Promise<WorkerTask[]> {
    const tasks = await this.deps.taskPlanner.decompose(swarm.task, {
      maxWorkers: swarm.config.maxWorkers,
      allowDependencies: false, // TODO: implement dependency handling
      outputFormat: 'json',
    })

    logger.info('Task decomposed', {
      swarmId: swarm.id,
      taskCount: tasks.length,
    })

    return tasks
  }

  /**
   * Spawns workers for all tasks.
   */
  private async spawnWorkers(
    swarmId: string,
    tasks: WorkerTask[],
  ): Promise<void> {
    logger.info('Spawning workers', { swarmId, taskCount: tasks.length })

    const spawnPromises = tasks.map(async (task) => {
      try {
        const worker = await this.deps.lifecycle.spawnWorker(swarmId, task)

        this.emit('event', {
          type: 'worker_spawned',
          swarmId,
          workerId: worker.id,
          taskId: task.id,
        } satisfies SwarmEvent)

        return worker
      } catch (error) {
        logger.error('Failed to spawn worker for task', {
          swarmId,
          taskId: task.id,
          error,
        })
        throw error
      }
    })

    await Promise.all(spawnPromises)
  }

  /**
   * Monitors execution until all workers complete or timeout.
   */
  private async monitorExecution(swarmId: string): Promise<void> {
    const swarm = this.deps.registry.getOrThrow(swarmId)

    return new Promise((resolve, reject) => {
      // Set up timeout
      const timeout = setTimeout(() => {
        cleanup()
        reject(new Error('Swarm execution timeout'))
      }, swarm.config.swarmTimeoutMs)

      // Subscribe to worker messages
      const unsubscribe = this.deps.messageBus.subscribeToMaster(
        swarmId,
        (message) => {
          const workerId = message.senderId

          switch (message.type) {
            case 'task_progress': {
              const payload = message.payload as {
                progress?: number
                currentAction?: string
              }
              if (payload.progress !== undefined) {
                this.deps.registry.updateWorkerProgress(
                  swarmId,
                  workerId,
                  payload.progress,
                  payload.currentAction,
                )

                this.emit('event', {
                  type: 'worker_progress',
                  swarmId,
                  workerId,
                  progress: payload.progress,
                } satisfies SwarmEvent)
              }
              break
            }

            case 'task_complete': {
              const payload = message.payload as {
                result?: unknown
                metrics?: {
                  durationMs: number
                  actionsPerformed: number
                  pagesVisited: number
                }
              }

              this.deps.registry.setWorkerResult(
                swarmId,
                workerId,
                payload.result,
                payload.metrics,
              )

              this.emit('event', {
                type: 'worker_completed',
                swarmId,
                workerId,
              } satisfies SwarmEvent)

              checkCompletion()
              break
            }

            case 'task_failed': {
              const payload = message.payload as { error?: string }

              this.deps.registry.setWorkerError(
                swarmId,
                workerId,
                payload.error ?? 'Task failed',
              )

              this.emit('event', {
                type: 'worker_failed',
                swarmId,
                workerId,
                error: payload.error ?? 'Unknown error',
              } satisfies SwarmEvent)

              checkCompletion()
              break
            }
          }
        },
      )

      const cleanup = () => {
        clearTimeout(timeout)
        unsubscribe()
      }

      const checkCompletion = () => {
        const activeCount = this.deps.lifecycle.getActiveWorkerCount(swarmId)

        if (activeCount === 0) {
          cleanup()
          resolve()
        }
      }

      // Initial check in case workers are already done
      checkCompletion()
    })
  }

  /**
   * Subscribes to swarm events.
   */
  onSwarmEvent(handler: (event: SwarmEvent) => void): () => void {
    this.on('event', handler)
    return () => this.off('event', handler)
  }
}
