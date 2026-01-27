/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * AI Swarm Mode - Public Exports
 *
 * Multi-agent swarm orchestration for parallel task execution.
 *
 * @example
 * ```typescript
 * import { SwarmService } from './swarm'
 *
 * const swarmService = new SwarmService(bridge, llmProvider)
 * await swarmService.initialize()
 *
 * const result = await swarmService.execute({
 *   task: 'Research top 5 CRM solutions',
 *   maxWorkers: 5,
 * })
 * ```
 */

// ============================================================================
// Types & Constants
// ============================================================================
export * from './types'
export * from './constants'

// ============================================================================
// Core Coordinator
// ============================================================================
export { SwarmCoordinator } from './coordinator/swarm-coordinator'
export type { SwarmCoordinatorDeps, SwarmEvent } from './coordinator/swarm-coordinator'
export { SwarmRegistry } from './coordinator/swarm-registry'
export { TaskPlanner } from './coordinator/task-planner'
export type { LLMProvider, DecompositionConfig } from './coordinator/task-planner'

// ============================================================================
// Worker Management
// ============================================================================
export { WorkerLifecycleManager } from './worker/worker-lifecycle'
export { SwarmWorkerAgent } from './worker/swarm-worker-agent'
export type {
  WorkerAgentState,
  WorkerAgentConfig,
  AgentAction,
  AgentStep,
  ExecutionPlan,
  ExecutionResult,
  BrowserController,
} from './worker/swarm-worker-agent'

// ============================================================================
// Messaging
// ============================================================================
export { SwarmMessagingBus } from './messaging/swarm-bus'
export type { MessageHandler, Unsubscribe } from './messaging/swarm-bus'

// ============================================================================
// Aggregation
// ============================================================================
export { ResultAggregator } from './aggregation/result-aggregator'
export type { LLMSynthesizer, AggregatedResult } from './aggregation/result-aggregator'
export { StreamingAggregator } from './aggregation/streaming-aggregator'
export type {
  StreamingConfig,
  WorkerResult,
  StreamingChunk,
  AggregatedStreamResult,
  AggregationMode,
} from './aggregation/streaming-aggregator'

// ============================================================================
// Scheduling
// ============================================================================
export { PriorityTaskQueue } from './scheduler/priority-queue'
export type { TaskPriority, ScheduledTask } from './scheduler/priority-queue'
export { LoadBalancer } from './scheduler/load-balancer'
export type {
  LoadBalancingStrategy,
  WorkerCapacity,
} from './scheduler/load-balancer'

// ============================================================================
// Resilience
// ============================================================================
export {
  CircuitBreaker,
  CircuitOpenError,
  Bulkhead,
  BulkheadFullError,
  BulkheadTimeoutError,
  TimeoutError,
  retryWithBackoff,
  withTimeout,
} from './resilience/circuit-breaker'
export type { CircuitState, CircuitBreakerConfig } from './resilience/circuit-breaker'

// ============================================================================
// Resource Pooling
// ============================================================================
export { WorkerPool } from './pool/worker-pool'
export type { PooledWorker, WorkerPoolConfig } from './pool/worker-pool'

// ============================================================================
// Observability
// ============================================================================
export { SwarmTracer, SwarmMetricsCollector, SwarmHealthChecker } from './observability/tracer'
export type {
  Span,
  SpanContext,
  SpanAttributes,
  SpanEvent,
  SpanKind,
  SpanStatus,
  TracerConfig,
  SwarmMetricsData,
  SwarmHealthStatus,
} from './observability/tracer'

// ============================================================================
// Unified Service (Main Entry Point)
// ============================================================================
export { SwarmService } from './service/swarm-service'
export type { SwarmServiceConfig } from './service/swarm-service'
