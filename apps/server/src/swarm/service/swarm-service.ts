/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * SwarmService - Unified swarm orchestration service
 *
 * Integrates all swarm components into a cohesive service
 * that can be plugged into the main server.
 */

import { EventEmitter } from 'node:events'
import type { ControllerBridge } from '../../browser/extension/bridge'
import { logger } from '../../lib/logger'
import { ResultAggregator } from '../aggregation/result-aggregator'
import { StreamingAggregator } from '../aggregation/streaming-aggregator'
import { SWARM_LIMITS } from '../constants'
import {
  SwarmCoordinator,
  type SwarmEvent,
} from '../coordinator/swarm-coordinator'
// Core
import { SwarmRegistry } from '../coordinator/swarm-registry'
import { type LLMProvider, TaskPlanner } from '../coordinator/task-planner'
import { SwarmMessagingBus } from '../messaging/swarm-bus'
import {
  SwarmHealthChecker,
  SwarmMetricsCollector,
  SwarmTracer,
} from '../observability/tracer'
import { WorkerPool } from '../pool/worker-pool'
import { Bulkhead, CircuitBreaker } from '../resilience/circuit-breaker'
import {
  LoadBalancer,
  type LoadBalancingStrategy,
} from '../scheduler/load-balancer'
// Advanced features
import { PriorityTaskQueue } from '../scheduler/priority-queue'
// Types
import type {
  SwarmConfig,
  SwarmRequest,
  SwarmResult,
  SwarmStatus,
} from '../types'
import { WorkerAgentManager } from '../worker/worker-agent-manager'
import { WorkerLifecycleManager } from '../worker/worker-lifecycle'

export interface SwarmServiceConfig extends Partial<SwarmConfig> {
  /** Enable worker pooling */
  enablePooling: boolean
  /** Pool configuration */
  poolConfig?: {
    minWorkers: number
    maxWorkers: number
  }
  /** Load balancing strategy */
  loadBalancingStrategy: LoadBalancingStrategy
  /** Enable circuit breaker */
  enableCircuitBreaker: boolean
  /** Enable distributed tracing */
  enableTracing: boolean
  /** Enable streaming aggregation */
  enableStreaming: boolean
  /** Bulkhead max concurrent swarms */
  maxConcurrentSwarms: number
}

const DEFAULT_SERVICE_CONFIG: SwarmServiceConfig = {
  enablePooling: true,
  poolConfig: {
    minWorkers: 2,
    maxWorkers: 10,
  },
  loadBalancingStrategy: 'resource-aware',
  enableCircuitBreaker: true,
  enableTracing: true,
  enableStreaming: true,
  maxConcurrentSwarms: SWARM_LIMITS.MAX_CONCURRENT_SWARMS,
}

export class SwarmService extends EventEmitter {
  // Core components
  private registry: SwarmRegistry
  private coordinator: SwarmCoordinator
  private taskPlanner: TaskPlanner
  private lifecycle: WorkerLifecycleManager
  private agentManager: WorkerAgentManager
  private messageBus: SwarmMessagingBus
  private aggregator: ResultAggregator

  // Advanced components
  private taskQueue: PriorityTaskQueue
  private loadBalancer: LoadBalancer
  private circuitBreaker?: CircuitBreaker
  private bulkhead: Bulkhead
  private workerPool?: WorkerPool
  private streamingAggregator: StreamingAggregator
  private tracer: SwarmTracer
  private metricsCollector: SwarmMetricsCollector
  private healthChecker: SwarmHealthChecker

  private config: SwarmServiceConfig
  private initialized = false

  constructor(
    bridge: ControllerBridge,
    llmProvider: LLMProvider,
    config: Partial<SwarmServiceConfig> = {},
  ) {
    super()
    this.config = { ...DEFAULT_SERVICE_CONFIG, ...config }

    // Initialize core components
    this.registry = new SwarmRegistry()
    this.messageBus = new SwarmMessagingBus()
    this.taskPlanner = new TaskPlanner(llmProvider)

    this.lifecycle = new WorkerLifecycleManager(
      bridge,
      this.registry,
      this.messageBus,
    )

    this.agentManager = new WorkerAgentManager({
      bridge,
      registry: this.registry,
      messageBus: this.messageBus,
      llmProvider,
    })

    this.aggregator = new ResultAggregator(this.registry)

    this.coordinator = new SwarmCoordinator(
      {
        bridge,
        registry: this.registry,
        taskPlanner: this.taskPlanner,
        lifecycle: this.lifecycle,
        agentManager: this.agentManager,
        messageBus: this.messageBus,
        aggregator: this.aggregator,
      },
      this.config,
    )

    // Initialize advanced components
    this.taskQueue = new PriorityTaskQueue()
    this.loadBalancer = new LoadBalancer({
      strategy: this.config.loadBalancingStrategy,
    })

    this.bulkhead = new Bulkhead(
      this.config.maxConcurrentSwarms,
      10, // queue size
      60_000, // queue timeout
    )

    this.streamingAggregator = new StreamingAggregator(this.registry, {
      enableStreaming: this.config.enableStreaming,
    })

    this.tracer = new SwarmTracer({
      enabled: this.config.enableTracing,
    })

    this.metricsCollector = new SwarmMetricsCollector()

    this.healthChecker = new SwarmHealthChecker([
      {
        name: 'registry',
        check: async () => ({ ok: true }),
        critical: true,
      },
      {
        name: 'message-bus',
        check: async () => ({ ok: true }),
        critical: true,
      },
    ])

    // Initialize circuit breaker
    if (this.config.enableCircuitBreaker) {
      this.circuitBreaker = new CircuitBreaker({
        name: 'swarm-service',
        failureThreshold: 3,
        resetTimeoutMs: 30_000,
      })
    }

    // Initialize worker pool
    if (this.config.enablePooling) {
      this.workerPool = new WorkerPool(bridge, this.config.poolConfig)
    }

    // Wire up event handlers
    this.setupEventHandlers()
  }

  /**
   * Initializes the swarm service.
   */
  async initialize(): Promise<void> {
    if (this.initialized) return

    logger.info('Initializing SwarmService', {
      pooling: this.config.enablePooling,
      circuitBreaker: this.config.enableCircuitBreaker,
      tracing: this.config.enableTracing,
    })

    // Initialize worker pool
    if (this.workerPool) {
      await this.workerPool.initialize()
    }

    // Add health checks
    this.healthChecker.addCheck(
      'worker-pool',
      async () => {
        if (!this.workerPool) return { ok: true, message: 'Pooling disabled' }
        const stats = this.workerPool.getStats()
        return {
          ok: stats.totalWorkers > 0,
          message: `${stats.totalWorkers} workers, ${stats.idleWorkers} idle`,
        }
      },
      false,
    )

    this.healthChecker.addCheck(
      'circuit-breaker',
      async () => {
        if (!this.circuitBreaker) return { ok: true, message: 'Disabled' }
        const state = this.circuitBreaker.getState()
        return {
          ok: state !== 'open',
          message: `State: ${state}`,
        }
      },
      true,
    )

    this.initialized = true
    this.emit('initialized')

    logger.info('SwarmService initialized')
  }

  /**
   * Creates and executes a swarm.
   */
  async execute(
    request: SwarmRequest,
    options: {
      priority?: 'critical' | 'high' | 'normal' | 'low' | 'background'
      outputFormat?: 'json' | 'markdown' | 'html'
      stream?: boolean
      onStatusChange?: (status: string) => Promise<void> | void
      onWorkerUpdate?: (
        workerId: string,
        update: Record<string, unknown>,
      ) => Promise<void> | void
      onProgress?: (
        progress: number,
        workerProgress?: Record<string, number>,
      ) => Promise<void> | void
    } = {},
  ): Promise<SwarmResult> {
    const span = this.tracer.startTrace('swarm.execute', {
      'swarm.task': request.task.slice(0, 100),
      'swarm.maxWorkers': request.maxWorkers ?? 'auto',
    })

    try {
      // Apply bulkhead
      await this.bulkhead.acquire()

      // Subscribe to coordinator events if callbacks provided
      const eventListeners: Array<() => void> = []

      if (
        options.onStatusChange ||
        options.onWorkerUpdate ||
        options.onProgress
      ) {
        const handleEvent = async (event: SwarmEvent) => {
          try {
            if (event.type === 'swarm_started' && options.onStatusChange) {
              await options.onStatusChange('spawning')
            } else if (
              event.type === 'worker_spawned' &&
              options.onWorkerUpdate
            ) {
              await options.onWorkerUpdate(event.workerId, {
                status: 'spawning',
              })
            } else if (
              event.type === 'worker_completed' &&
              options.onWorkerUpdate
            ) {
              await options.onWorkerUpdate(event.workerId, {
                status: 'completed',
              })
            } else if (
              event.type === 'worker_failed' &&
              options.onWorkerUpdate
            ) {
              await options.onWorkerUpdate(event.workerId, {
                status: 'failed',
                error: event.error,
              })
            } else if (event.type === 'worker_progress' && options.onProgress) {
              await options.onProgress(event.progress)
            } else if (
              event.type === 'aggregation_started' &&
              options.onStatusChange
            ) {
              await options.onStatusChange('aggregating')
            }
          } catch (e) {
            logger.warn('Error in swarm event callback', { error: e })
          }
        }

        this.coordinator.on('event', handleEvent)
        eventListeners.push(() => this.coordinator.off('event', handleEvent))
      }

      // Apply circuit breaker
      const executeWithBreaker = async () => {
        return await this.coordinator.createAndExecute(request, {
          outputFormat: options.outputFormat ?? 'markdown',
        })
      }

      let result: SwarmResult

      if (this.circuitBreaker) {
        result = await this.circuitBreaker.execute(executeWithBreaker)
      } else {
        result = await executeWithBreaker()
      }

      // Clean up event listeners
      for (const cleanup of eventListeners) {
        cleanup()
      }

      this.tracer.endSpan(span, 'ok')

      return result
    } catch (error) {
      this.tracer.recordException(span, error as Error)
      this.tracer.endSpan(span, 'error', (error as Error).message)
      throw error
    } finally {
      this.bulkhead.release()
    }
  }

  /**
   * Executes a swarm with streaming results.
   */
  async *executeStreaming(
    request: SwarmRequest,
    options: {
      outputFormat?: 'json' | 'markdown' | 'html'
    } = {},
  ): AsyncIterable<{ type: string; data: unknown }> {
    const swarm = await this.coordinator.createSwarm(request)
    const stream = this.streamingAggregator.createStream(swarm.id)

    // Start execution in background
    const executionPromise = this.coordinator.executeSwarm(swarm.id, options)

    // Yield streaming chunks
    for await (const chunk of stream) {
      yield { type: chunk.type, data: chunk }
    }

    // Wait for completion
    const result = await executionPromise
    yield { type: 'complete', data: result }
  }

  /**
   * Gets status of a swarm.
   */
  getStatus(swarmId: string): SwarmStatus | undefined {
    return this.coordinator.getStatus(swarmId)
  }

  /**
   * Terminates a running swarm.
   */
  async terminate(swarmId: string): Promise<void> {
    await this.coordinator.terminateSwarm(swarmId)
    this.streamingAggregator.cleanup(swarmId)
  }

  /**
   * Gets service health.
   */
  async getHealth() {
    return this.healthChecker.check()
  }

  /**
   * Gets service metrics.
   */
  getMetrics(swarmId?: string) {
    if (swarmId) {
      return this.metricsCollector.getLatest(swarmId)
    }

    return {
      activeSwarms: this.registry.getActiveSwarms().length,
      bulkhead: this.bulkhead.getState(),
      circuitBreaker: this.circuitBreaker?.getStats(),
      loadBalancer: this.loadBalancer.getStats(),
      workerPool: this.workerPool?.getStats(),
      tracer: {
        activeSpans: this.tracer.getActiveSpans().length,
      },
    }
  }

  /**
   * Gets tracing data for a swarm.
   */
  getTrace(traceId: string) {
    return this.tracer.getTrace(traceId)
  }

  /**
   * Sets up event handlers between components.
   */
  private setupEventHandlers(): void {
    // Forward coordinator events
    this.coordinator.onSwarmEvent((event: SwarmEvent) => {
      this.emit('swarm_event', event)

      // Record metrics
      if ('swarmId' in event) {
        const status = this.registry.getStatus(event.swarmId)
        if (status) {
          this.metricsCollector.record({
            swarmId: event.swarmId,
            swarmState: status.state,
            workerCount: status.workers.total,
            activeWorkers: status.workers.running,
            completedWorkers: status.workers.completed,
            failedWorkers: status.workers.failed,
            taskQueueSize: this.taskQueue.size(),
            avgWorkerLatencyMs: 0, // Would need actual data
            avgTaskDurationMs: 0,
            memoryUsageMb: 0,
            cpuUtilization: 0,
            throughputTasksPerMin: 0,
            errorRate:
              status.workers.failed / Math.max(status.workers.total, 1),
          })
        }
      }
    })

    // Forward streaming events
    this.streamingAggregator.on('chunk', (chunk) => {
      this.emit('stream_chunk', chunk)
    })

    // Forward pool events
    this.workerPool?.on('worker_created', (worker) => {
      this.loadBalancer.registerWorker(worker.id, worker.windowId)
    })

    this.workerPool?.on('worker_terminated', (worker) => {
      this.loadBalancer.unregisterWorker(worker.id)
    })

    // Handle circuit breaker events
    this.circuitBreaker?.on('open', () => {
      logger.warn('Circuit breaker opened for swarm service')
      this.emit('circuit_open')
    })

    this.circuitBreaker?.on('closed', () => {
      logger.info('Circuit breaker closed for swarm service')
      this.emit('circuit_closed')
    })
  }

  /**
   * Subscribes to swarm events.
   */
  onEvent(handler: (event: SwarmEvent) => void): () => void {
    this.on('swarm_event', handler)
    return () => this.off('swarm_event', handler)
  }

  /**
   * Shuts down the service.
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down SwarmService')

    // Terminate all active swarms
    const activeSwarms = this.registry.getActiveSwarms()
    for (const swarm of activeSwarms) {
      await this.terminate(swarm.id)
    }

    // Shutdown components
    if (this.workerPool) {
      await this.workerPool.shutdown()
    }

    await this.tracer.shutdown()

    this.lifecycle.cleanup()

    this.emit('shutdown')
    logger.info('SwarmService shutdown complete')
  }

  // Expose components for advanced usage
  get components() {
    return {
      registry: this.registry,
      coordinator: this.coordinator,
      taskPlanner: this.taskPlanner,
      lifecycle: this.lifecycle,
      messageBus: this.messageBus,
      taskQueue: this.taskQueue,
      loadBalancer: this.loadBalancer,
      workerPool: this.workerPool,
      streamingAggregator: this.streamingAggregator,
      tracer: this.tracer,
      metricsCollector: this.metricsCollector,
    }
  }
}
