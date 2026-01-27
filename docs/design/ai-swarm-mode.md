# AI Swarm Mode - Technical Design Document

> **Version:** 1.0  
> **Status:** Implementation In Progress  
> **Issue:** #279

## Overview

AI Swarm Mode enables a master agent to spawn and orchestrate multiple worker agents in separate browser windows, parallelizing complex multi-step tasks.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    SwarmCoordinator                          │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────┐     │
│  │SwarmRegistry│  │ TaskPlanner  │  │ResultAggregator │     │
│  └──────┬──────┘  └──────┬───────┘  └────────┬────────┘     │
│         │                │                   │               │
│         └────────────────┼───────────────────┘               │
│                          │                                   │
│  ┌───────────────────────┴───────────────────────────────┐  │
│  │              WorkerLifecycleManager                    │  │
│  │   spawn()  •  monitor()  •  terminate()  •  recover()  │  │
│  └───────────────────────────────────────────────────────┘  │
└──────────────────────────────┬───────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                     SwarmMessagingBus                        │
│         (EventEmitter-based pub/sub communication)           │
└──────────────────────────────┬───────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                     ControllerBridge                         │
│              (Multi-window WebSocket routing)                │
└─────────────────────────────────────────────────────────────┘
```

## Components

### SwarmRegistry
Tracks active swarms and their workers with state management.

### TaskPlanner
LLM-powered decomposition of complex tasks into parallel subtasks.

### WorkerLifecycleManager
Manages worker window spawning, health monitoring, and termination.

### SwarmMessagingBus
Event-based pub/sub for master-worker communication.

### ResultAggregator
Merges worker results with support for partial failures.

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /swarm | Create and execute swarm |
| POST | /swarm/create | Create swarm without executing |
| POST | /swarm/:id/execute | Execute existing swarm |
| GET | /swarm/:id | Get swarm status |
| GET | /swarm/:id/stream | SSE for real-time updates |
| DELETE | /swarm/:id | Terminate swarm |

## Message Protocol

```typescript
type SwarmMessage = {
  id: string
  timestamp: number
  swarmId: string
  senderId: string  // 'master' or 'worker-{id}'
  targetId: string  // 'master', 'worker-{id}', or 'broadcast'
  type: 'task_assign' | 'task_progress' | 'task_complete' | 'task_failed' | 'heartbeat' | 'terminate'
  payload: unknown
}
```

## Configuration

```typescript
const SWARM_LIMITS = {
  MAX_WORKERS: 10,
  DEFAULT_WORKERS: 5,
  MAX_RETRIES_PER_WORKER: 3,
}

const SWARM_TIMEOUTS = {
  WORKER_SPAWN_MS: 10_000,
  HEARTBEAT_INTERVAL_MS: 5_000,
  TASK_DEFAULT_MS: 300_000,  // 5 min
  SWARM_DEFAULT_MS: 600_000, // 10 min
}
```

## Usage Example

```typescript
const coordinator = new SwarmCoordinator(deps, config)

const result = await coordinator.createAndExecute({
  task: 'Research and compare the top 5 CRM solutions',
  maxWorkers: 5,
})

// result = {
//   swarmId: '...',
//   partial: false,
//   result: '# CRM Comparison Report...',
//   metrics: { totalDurationMs: 180000, ... }
// }
```

## Implementation Status

- [x] Core types and constants
- [x] SwarmRegistry
- [x] SwarmMessagingBus
- [x] WorkerLifecycleManager
- [x] TaskPlanner
- [x] ResultAggregator
- [x] SwarmCoordinator
- [x] API routes
- [ ] Integration with main server
- [ ] Worker agent implementation
- [ ] UI components
- [ ] Chromium-side SwarmWindowManager
