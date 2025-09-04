# Evals2 - Simplified Evaluation System

## Overview

Evals2 is a lightweight evaluation system that tracks agent execution metrics and scores task completion quality. It's a simplified replacement for the original evaluation system with ~75% less code complexity.

## Key Features

- **Lightweight Tool Tracking**: Simple Map-based duration tracking (no complex spans)
- **4-Category Scoring**: Goal completion (40%), Plan correctness (30%), Error-free execution (15%), Context efficiency (15%)
- **Session Management**: Maintains parent-child span relationships for Braintrust hierarchy
- **Minimal Integration**: Only 2 hooks in existing code (BrowserAgent + NxtScape)

## Usage

### Enabling Evals2

Set the environment variable:
```bash
export ENABLE_EVALS2=true
export BRAINTRUST_API_KEY=your-key  # Required for uploading scores
```

### How It Works

1. **Session Start**: When a conversation begins, SimpleBraintrustEventManager creates a parent span
2. **Tool Execution**: Each tool call is wrapped with SimpleToolWrapper to track duration
3. **Task Scoring**: After task completion, SimplifiedScorer analyzes messages and tool metrics
4. **Score Upload**: Scores are sent to Braintrust via SimpleBraintrustLogger

### Architecture

```
NxtScape
  ├── SimpleBraintrustEventManager (session management)
  │   └── Creates parent span for conversation
  │
  ├── BrowserAgent
  │   └── wrapToolForMetrics() (duration tracking)
  │       └── Stores metrics in ExecutionContext.toolMetrics Map
  │
  └── SimplifiedScorer (post-execution scoring)
      ├── Extracts tool calls from messages
      ├── Uses tool metrics for accurate durations
      └── Calculates 4 dimension scores

SimpleBraintrustLogger
  └── Uploads scores to Braintrust dashboard
```

## Components

### SimpleToolWrapper.ts
- Wraps tools with lightweight duration tracking
- Stores metrics in ExecutionContext.toolMetrics Map
- Adds ~1ms overhead per tool call

### SimplifiedScorer.ts
- Scores tasks based on message history
- 4 scoring dimensions with configurable weights
- Can use LLM for goal/plan scoring or fallback to heuristics

### SimpleBraintrustEventManager.ts
- Singleton session manager
- Maintains parent span for conversation hierarchy
- Tracks task scores for session averaging

### SimpleBraintrustLogger.ts
- Simple Braintrust integration for score upload
- No complex span management
- Lazy loads Braintrust SDK

## Differences from Original System

| Aspect | Old Evals | Evals2 |
|--------|-----------|--------|
| Code Size | ~2000 lines | ~500 lines |
| Scoring Dimensions | 6 complex | 4 simple |
| Tool Tracking | Braintrust wrapTraced | Map-based duration |
| Session Management | Complex telemetry | Simple parent span |
| Dependencies | Multiple | Minimal |

## Testing

```bash
# Run unit tests
npm run test:run -- src/evals2/SimplifiedScorer.test.ts

# Run integration tests
npm run test:run -- src/evals2/integration.test.ts
```

## Monitoring

Scores appear in Braintrust dashboard at:
https://braintrust.dev/app/Felafax/p/browseros-agent-online/logs

Look for events with:
- Type: `evals2_task_score`
- Session events: `agent_session`