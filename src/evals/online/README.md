# Online Telemetry Implementation

> Implementation details for the real-time telemetry and scoring subsystem. For general overview, see [parent README](../README.md).

## Quick Start

### Enable Telemetry & Scoring

```typescript
// src/config.ts
export const ENABLE_TELEMETRY = true                   // Master switch
export const BRAINTRUST_API_KEY = 'sk-...'             // Telemetry backend
export const OPENAI_API_KEY_FOR_SCORING = 'sk-...'     // LLM judge
export const OPENAI_MODEL_FOR_SCORING = 'gpt-4o-mini'  // Scoring model
```

```bash
npm run build:dev
# View data at Braintrust dashboard → browseros-agent-online
```

## Directory Structure

```
src/evals/online/
├── BraintrustEventCollector.ts   # Singleton telemetry collector with lazy initialization
├── tool-wrapper.ts               # Tool wrapper factory for automatic tracking (metrics only)
└── scoring/                      # LLM scoring subsystem
    ├── LLMJudge.ts               # Multi-dimensional scoring engine
    ├── LLMJudge.prompts.ts       # Scoring prompts and criteria
    └── scoring-openai.ts         # Raw OpenAI client for scoring (no telemetry)
```

## Key Components

### BraintrustEventCollector.ts
- **Pattern**: Singleton with lazy initialization on first `initializeSession()` call
- **Purpose**: Manages Braintrust logger instance and span hierarchy
- **Capabilities**: Provides `startSpan()`, `endSpan()`, `logEvent()`, `flush()` methods
- **Integration**: Direct access to ExecutionContext for metadata

### tool-wrapper.ts (createTrackedTool)
- **Pattern**: Factory function that wraps any DynamicStructuredTool
- **Purpose**: Automatic span creation and metrics tracking
- **Implementation**: Uses Braintrust's `wrapTraced()` for instrumentation
- **Performance**: Zero-overhead early return when telemetry disabled
- **Data**: Returns metrics only (duration, success) - no I/O duplication

### scoring/LLMJudge.ts
- **Pattern**: Direct ExecutionContext access to stores (MessageManager, TodoStore, BrowserContext)
- **Purpose**: Multi-dimensional task evaluation across 6 criteria
- **Implementation**: Raw OpenAI client (not wrapped) to avoid nested telemetry spans
- **Scoring**: Weighted average calculation with fallback score (-1) when unavailable

### Integration Points

#### Tool Wrapping in BrowserAgent

When telemetry is enabled, BrowserAgent wraps all tools during registration:

```typescript
// In BrowserAgent._registerTools()
if (this.executionContext.telemetry?.isEnabled()) {
  const registerTool = (tool: DynamicStructuredTool) => {
    const trackedTool = createTrackedTool(tool, this.executionContext)
    this.toolManager.register(trackedTool)
  }
  
  // All 16 tools automatically tracked
  registerTool(createClassificationTool(...))
  registerTool(createPlannerTool(...))
  // ... continues for all tools
}
```

#### Session Initialization in NxtScape

```typescript
// First task initializes telemetry session
if (this.executionContext.telemetry && this.taskNumber === 1) {
  await this.executionContext.telemetry.initializeSession(sessionId)
}

// Task completion triggers scoring
const judge = new LLMJudge()
const result = await judge.scoreTaskCompletionWithContext(
  userQuery,
  executionContext,  // Direct access to all stores
  taskOutcome
)

```

### Data Collection Strategy

**Braintrust Events (Metrics Only)**
```typescript
// tool-wrapper.ts
{
  duration_ms: endTime - startTime,
  success: result.ok ? 1 : 0,
  is_exception: result.error ? 1 : 0,
  toolName: tool.name,
  messageIndex: messageManager.getMessages().length
}
```

**LLM Judge Context (Direct References)**
```typescript
// LLMJudge.scoreTaskCompletionWithContext()
const context = {
  messages: executionContext.messageManager.getMessages(),  // Full array
  todos: executionContext.todoStore.getAll(),               // All TODOs
  browserState: executionContext.browserContext.getState(), // Current state
  taskOutcome: outcome                                      // From NxtScape
}
```

## Event Hierarchy in Braintrust

```
🔹 agent_session (parent span for conversation)
  │
  ├─ Task 1: "Find headphones under $100"
  │  ├─ task_1_start (event)
  │  ├─ tool:classification_tool (span with metrics)
  │  ├─ tool:planner_tool (span with metrics)
  │  ├─ tool:navigation_tool (span with metrics)
  │  ├─ tool:extract_tool (span with metrics)
  │  ├─ tool:done_tool (span with metrics)
  │  └─ task_1_complete (event with scores)
  │
  └─ Task 2: "Show only wireless ones"
     └─ ... more tool executions
```

## Performance Impact

| State | Overhead | Details |
|-------|----------|---------|
| **Disabled** | 0ms | All telemetry code skipped entirely |
| **Enabled (no scoring)** | <1ms per event | Network calls are async/non-blocking |
| **Enabled (with scoring)** | ~2-3ms per event | LLM scoring is async/non-blocking |

Zero overhead when disabled:
```typescript
if (!telemetry?.isEnabled()) {
  return originalFunc(input)  // Direct execution
}
```

## Implementation Principles

1. **Direct Store Access**: LLM Judge accesses ExecutionContext stores directly, no data copying
2. **Metrics-Only Telemetry**: Braintrust receives lightweight metrics, not full I/O
3. **Lazy Singleton**: BraintrustEventCollector initializes once on first session
4. **Zero-Overhead When Disabled**: Early return paths when `ENABLE_TELEMETRY = false`

## Debugging

### Common Issues

**No data in Braintrust?**
1. Verify `ENABLE_TELEMETRY = true` in config.ts
2. Check for `BRAINTRUST_API_KEY` in config.ts
3. Look for `✓ Telemetry ready` in console
4. Rebuild after config changes: `npm run build:dev`

**No scores appearing?**
1. Verify `OPENAI_API_KEY_FOR_SCORING` in config.ts
2. Check for `✓ LLM Judge ready` in console
3. Ensure task completes (not interrupted)
4. Look for `📊 Multi-Dimensional LLM Scores` in console

**Low goal_achievement scores?**
- Usually means agent didn't communicate results to user
- Even if calculation/action completed successfully
- Agent must use `done_tool` or similar to report results
