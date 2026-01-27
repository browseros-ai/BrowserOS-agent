/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * AI Swarm Mode - Public Exports
 *
 * Multi-agent swarm orchestration for parallel task execution.
 */

// Types
export * from './types'

// Constants
export * from './constants'

// Coordinator
export { SwarmCoordinator } from './coordinator/swarm-coordinator'
export type { SwarmCoordinatorDeps, SwarmEvent } from './coordinator/swarm-coordinator'
export { SwarmRegistry } from './coordinator/swarm-registry'
export { TaskPlanner } from './coordinator/task-planner'
export type { LLMProvider, DecompositionConfig } from './coordinator/task-planner'

// Worker
export { WorkerLifecycleManager } from './worker/worker-lifecycle'

// Messaging
export { SwarmMessagingBus } from './messaging/swarm-bus'
export type { MessageHandler, Unsubscribe } from './messaging/swarm-bus'

// Aggregation
export { ResultAggregator } from './aggregation/result-aggregator'
export type { LLMSynthesizer, AggregatedResult } from './aggregation/result-aggregator'
