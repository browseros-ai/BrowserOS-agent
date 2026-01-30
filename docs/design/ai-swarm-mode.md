# AI Swarm Mode - Technical Design Document

> **Version:** 2.0  
> **Status:** Core Implementation Complete  
> **Issue:** #279

## Overview

AI Swarm Mode enables a master agent to spawn and orchestrate multiple worker agents in separate browser windows, parallelizing complex multi-step tasks. This is a production-grade implementation with enterprise features including circuit breakers, load balancing, resource pooling, distributed tracing, and streaming aggregation.

## Architecture

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                              SwarmService                                     │
│   ┌────────────────────────────────────────────────────────────────────┐     │
│   │                       SwarmCoordinator                              │     │
│   │  ┌─────────────┐  ┌──────────────┐  ┌─────────────────────────┐   │     │
│   │  │SwarmRegistry│  │ TaskPlanner  │  │ StreamingAggregator     │   │     │
│   │  └──────┬──────┘  └──────┬───────┘  └───────────┬─────────────┘   │     │
│   │         │                │                      │                  │     │
│   │         └────────────────┼──────────────────────┘                  │     │
│   └──────────────────────────┼─────────────────────────────────────────┘     │
│                              │                                                │
│   ┌──────────────────────────┴─────────────────────────────────────────┐     │
│   │                    Advanced Components                              │     │
│   │  ┌──────────────┐ ┌──────────────┐ ┌───────────────────────────┐  │     │
│   │  │PriorityQueue │ │ LoadBalancer │ │ CircuitBreaker + Bulkhead │  │     │
│   │  └──────────────┘ └──────────────┘ └───────────────────────────┘  │     │
│   │  ┌──────────────────────────────────────────────────────────────┐ │     │
│   │  │                      WorkerPool                               │ │     │
│   │  │   Pre-warmed workers • Auto-scaling • Resource isolation      │ │     │
│   │  └──────────────────────────────────────────────────────────────┘ │     │
│   └────────────────────────────────────────────────────────────────────┘     │
│                                                                              │
│   ┌────────────────────────────────────────────────────────────────────┐     │
│   │                      Observability                                  │     │
│   │  ┌─────────────┐  ┌─────────────────┐  ┌────────────────────────┐ │     │
│   │  │ SwarmTracer │  │ MetricsCollector│  │ HealthChecker          │ │     │
│   │  └─────────────┘  └─────────────────┘  └────────────────────────┘ │     │
│   └────────────────────────────────────────────────────────────────────┘     │
└────────────────────────────────┬─────────────────────────────────────────────┘
                                 │
                                 ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                         Worker Layer                                          │
│  ┌──────────────────────────────────────────────────────────────────────┐    │
│  │                    SwarmWorkerAgent                                   │    │
│  │   LLM Planning • Browser Automation • Progress Reporting • Recovery  │    │
│  └──────────────────────────────────────────────────────────────────────┘    │
│  ┌──────────────────────────────────────────────────────────────────────┐    │
│  │                    SwarmMessagingBus                                  │    │
│  │               EventEmitter pub/sub communication                      │    │
│  └──────────────────────────────────────────────────────────────────────┘    │
└────────────────────────────────┬─────────────────────────────────────────────┘
                                 │
                                 ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                         ControllerBridge                                      │
│                   Multi-window WebSocket routing                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

## Core Components

### SwarmService (Main Entry Point)
Unified service that integrates all components. Single point of configuration.

### SwarmCoordinator
Orchestrates swarm lifecycle: planning → spawning → executing → aggregating.

### SwarmRegistry
Tracks active swarms and workers with state management.

### TaskPlanner
LLM-powered decomposition of complex tasks into parallel subtasks.

### SwarmWorkerAgent
Autonomous agent that runs in worker windows, executes tasks with LLM-guided planning.

## Advanced Features

### PriorityTaskQueue
- Priority-based scheduling (critical, high, normal, low, background)
- Dependency graph resolution
- Deadline awareness with urgency boosting
- Fair scheduling with aging

### LoadBalancer
Strategies: `round-robin`, `least-connections`, `weighted`, `resource-aware`, `latency-based`
- Worker capacity tracking
- Sticky sessions support
- Health-aware routing

### CircuitBreaker + Bulkhead
- Failure threshold monitoring
- Automatic recovery with half-open state
- Concurrent execution limiting
- Fallback support

### WorkerPool
- Pre-warmed workers for instant task assignment
- Auto-scaling based on utilization
- Idle worker termination
- Resource pooling

### StreamingAggregator
- Real-time result streaming via SSE
- Multiple aggregation modes: merge, concat, vote, custom
- Conflict detection and resolution
- Progressive result building

### Observability
- **SwarmTracer**: OpenTelemetry-compatible distributed tracing
- **MetricsCollector**: Real-time metrics with history
- **HealthChecker**: Comprehensive health endpoints

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /swarm | Create and execute swarm |
| POST | /swarm/stream | Execute with SSE streaming |
| GET | /swarm/:id | Get swarm status |
| GET | /swarm/:id/stream | SSE for real-time updates |
| DELETE | /swarm/:id | Terminate swarm |
| GET | /swarm/health | Service health check |
| GET | /swarm/metrics | Service metrics |
| GET | /swarm/metrics/:id | Swarm-specific metrics |
| GET | /swarm/trace/:id | Trace data |

## Usage Example

```typescript
import { SwarmService } from './swarm'

// Initialize service
const swarmService = new SwarmService(bridge, llmProvider, {
  enablePooling: true,
  enableCircuitBreaker: true,
  enableTracing: true,
  loadBalancingStrategy: 'resource-aware',
})

await swarmService.initialize()

// Execute with priority
const result = await swarmService.execute(
  {
    task: 'Research and compare the top 5 CRM solutions',
    maxWorkers: 5,
  },
  {
    priority: 'high',
    outputFormat: 'markdown',
  }
)

// Or stream results
for await (const chunk of swarmService.executeStreaming(request)) {
  console.log(chunk.type, chunk.data)
}

// Get metrics
const metrics = swarmService.getMetrics()

// Health check
const health = await swarmService.getHealth()
```

## Implementation Status

### ✅ Core
- [x] Types and constants
- [x] SwarmRegistry
- [x] SwarmMessagingBus
- [x] WorkerLifecycleManager
- [x] TaskPlanner
- [x] ResultAggregator
- [x] SwarmCoordinator

### ✅ Advanced
- [x] PriorityTaskQueue with dependency resolution
- [x] LoadBalancer with 5 strategies
- [x] CircuitBreaker + Bulkhead patterns
- [x] WorkerPool with auto-scaling
- [x] StreamingAggregator with conflict resolution

### ✅ Observability
- [x] SwarmTracer (OpenTelemetry-compatible)
- [x] MetricsCollector
- [x] HealthChecker

### ✅ Worker
- [x] SwarmWorkerAgent implementation
- [x] LLM-guided execution planning
- [x] Browser automation integration

### ✅ Integration
- [x] SwarmService unified entry point
- [x] Enhanced API routes with streaming
- [x] Health/metrics/tracing endpoints
- [x] Server router integration

### ✅ Extension (controller-ext)
- [x] SwarmWindowManager
- [x] Swarm action handlers (create, navigate, focus, close, arrange)
- [x] Window tracking and cleanup

### ✅ UI (agent)
- [x] SwarmPanel component
- [x] SwarmWorkerCard component
- [x] SwarmTrigger component
- [x] useSwarm hook

### 🔄 Pending
- [ ] Wire SwarmTrigger to chat input
- [ ] E2E integration testing

## Files Structure

```
apps/server/src/swarm/
├── index.ts                         # Public exports
├── types.ts                         # Core types with Zod schemas
├── constants.ts                     # Limits, timeouts, defaults
├── coordinator/
│   ├── swarm-coordinator.ts         # Main orchestrator
│   ├── swarm-registry.ts            # Swarm tracking
│   └── task-planner.ts              # LLM task decomposition
├── worker/
│   ├── worker-lifecycle.ts          # Worker management
│   └── swarm-worker-agent.ts        # Autonomous worker agent
├── messaging/
│   └── swarm-bus.ts                 # Pub/sub messaging
├── aggregation/
│   ├── result-aggregator.ts         # Basic aggregation
│   └── streaming-aggregator.ts      # Real-time streaming
├── scheduler/
│   ├── priority-queue.ts            # Priority scheduling
│   └── load-balancer.ts             # Worker load distribution
├── resilience/
│   └── circuit-breaker.ts           # Fault tolerance
├── pool/
│   └── worker-pool.ts               # Resource pooling
├── observability/
│   └── tracer.ts                    # Tracing + metrics + health
└── service/
    └── swarm-service.ts             # Unified service

apps/controller-ext/src/actions/swarm/
├── index.ts                         # Public exports
├── SwarmWindowManager.ts            # Window lifecycle management
└── SwarmActions.ts                  # Action handlers

apps/agent/components/swarm/
├── index.ts                         # Public exports
├── types.ts                         # UI types
├── SwarmPanel.tsx                   # Main visualization panel
├── SwarmWorkerCard.tsx              # Worker status card
└── SwarmTrigger.tsx                 # Chat mode toggle

apps/agent/lib/swarm/
└── useSwarm.ts                      # React hook for swarm state
```
