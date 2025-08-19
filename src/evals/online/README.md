# Online Telemetry System

## Overview

Seamless telemetry integration for the BrowserOS agent using Braintrust SDK. Tools are automatically wrapped with tracking when telemetry is enabled - no manual instrumentation needed. (only used in dev environments)

## Quick Start

### 1. Configure in `src/config.ts`
```typescript
export const ENABLE_TELEMETRY = true;
export const BRAINTRUST_API_KEY = 'your-api-key-here';
```

### 2. Build and Run
```bash
npm run build:dev
# Reload Chrome extension
```

### 3. View Data
View in Braintrust dashboard → `browseros-agent-online` project

## How It Works

### Seamless Tool Integration

**The magic happens in BrowserAgent:** When telemetry is enabled, all tools are automatically wrapped with tracking - you don't need to modify any tool code!

```typescript
// src/lib/agent/BrowserAgent.ts
private _registerTools(): void {
  if (this.executionContext.telemetry?.isEnabled()) {
    // Every tool gets wrapped automatically
    const registerTool = (tool: DynamicStructuredTool) => {
      const trackedTool = createTrackedTool(tool, this.executionContext)
      this.toolManager.register(trackedTool)
    }
    
    // All tools now have telemetry!
    registerTool(createClassificationTool(...))
    registerTool(createPlannerTool(...))
    registerTool(createNavigationTool(...))
    // ... etc
  }
}
```

### Data Flow Architecture

```
1. User Query
   ↓
2. NxtScape.run()
   - Creates conversation session (parent span)
   - Passes telemetry to ExecutionContext
   - Sets ExecutionContext → Creates EventEnricher
   ↓
3. EventEnricher Initialized
   - Created in BraintrustEventCollector.setExecutionContext()
   - Has access to all runtime state via ExecutionContext
   ↓
4. BrowserAgent.execute()
   - Receives telemetry via ExecutionContext
   - Wraps all tools with createTrackedTool()
   ↓
5. Tool Execution
   - Wrapper logs: start → execute → end/error
   - Events automatically enriched with context
   ↓
6. Event Enrichment (Automatic)
   - EventEnricher adds conversation history
   - Includes current plan and progress
   - Captures browser state (URL, tabs)
   ↓
7. Braintrust SDK
   - Batches enriched events (handled by SDK)
   - Sends to Braintrust API
   ↓
8. View in Dashboard
   - Traces show full execution hierarchy
   - Rich context for debugging
   - Analyze performance and errors
```

## What Gets Logged

### Automatic Context Enrichment via EventEnricher

Every telemetry event is automatically enriched with contextual data by the EventEnricher:

**For Tool Executions & Decision Points:**
- **Conversation Context**
  - Current conversation turn number
  - Total message history length
  - Last 3 messages (truncated to ~150 chars each)
  - Original user intent from first message
- **Plan Context** (if a plan exists)
  - All plan steps (first 5)
  - Current step being executed
  - Whether this is a re-planning scenario
- **Browser State**
  - Current page URL and title
  - Number of open tabs
  - Active tab ID

**For Browser Actions:**
- Only browser state is captured (lighter weight)

This enrichment happens automatically - no manual instrumentation needed!

### Event Hierarchy

Every conversation creates a nested trace structure:

```
🔹 Conversation Session (parent)
  │
  ├─ Task 1: "Find headphones under $100"
  │  ├─ decision_point: task_1_start
  │  ├─ tool_execution: classification_tool (234ms)
  │  ├─ tool_execution: planner_tool (456ms)
  │  ├─ tool_execution: navigate_tool (89ms)
  │  ├─ tool_execution: extract_tool (123ms)
  │  ├─ tool_execution: done_tool (45ms)
  │  └─ decision_point: task_1_complete
  │
  └─ Task 2: "Show only wireless ones"
     ├─ decision_point: task_2_start
     └─ ... more tool executions
```


## How Data is Sent to Braintrust

### 1. Lazy Initialization
```typescript
// BraintrustEventCollector.ts
private _ensureInitialized(): void {
  if (this.initialized) return;
  
  // Only initialize when first used
  if (ENABLE_TELEMETRY && BRAINTRUST_API_KEY) {
    this.logger = initLogger({
      apiKey: BRAINTRUST_API_KEY,
      projectName: 'browseros-agent-online'
    })
  }
}
```

### 2. Tool Execution Wrapped in Traced Spans
```typescript
// Tools are wrapped INSIDE traced spans for proper waterfall visualization
return telemetry.runInSpan(
  toolName,
  context.parentSpanId,
  async (span) => {
    // Log start to the span
    span.log({ input, phase: 'start' })
    
    // Execute the actual tool - THIS is what gets measured
    const result = await originalFunc(input)
    
    // Log completion to the same span
    span.log({ output: result, phase: 'completed', metrics: { duration_ms } })
    
    return result
  }
)
```

This creates proper duration bars in the Braintrust waterfall view, not just point-in-time events.

### 3. SDK Handles the Rest
- **Batching**: Events are automatically batched by Braintrust SDK
- **Retry Logic**: Failed requests are retried automatically
- **Async**: All telemetry is non-blocking (doesn't slow down execution)
- **Flush**: SDK ensures data is sent even if the app closes

## Console Output

When telemetry is enabled, you'll see:

```
✓ Telemetry ready (API key found)
✓ Telemetry session initialized
  Session ID: abc-123-xyz...
→ Task 1: "Find headphones under $100"
→ Tools registered with telemetry tracking
→ Tool: classification_tool (234ms)
→ Tool: planner_tool (456ms)
→ Tool: navigate_tool (89ms)
→ Tool: extract_tool (123ms)
→ Tool: done_tool (45ms)
```

## Next Iteration: LLM-as-Judge Scoring

**Status: Planned** 📋

Currently, telemetry collects comprehensive execution data with rich context. The next iteration will add automatic quality scoring using LLM-as-judge patterns:

### What Will Be Scored

**Per Tool Execution:**
- Performance (speed relative to baseline)
- Success rate (ok=true frequency)
- Quality metrics:
  - Plans: Step coherence, completeness, logical ordering
  - Validations: Accuracy of completion detection
  - Extractions: Data completeness and relevance
  - Navigation: Success reaching target pages

**Per Task:**
- Overall success rate
- Efficiency (optimal tool usage)
- Speed vs complexity
- Error recovery effectiveness

### How It Will Work

```typescript
// Scores calculated locally during execution
const scores = {
  performance: duration < 500 ? 1.0 : 0.5,
  success: result.ok ? 1.0 : 0.0,
  plan_quality: assessPlanQuality(result.steps),  // LLM scoring
  overall: weightedAverage(allScores)
}

// Sent to Braintrust with telemetry
await telemetry.logEvent({
  type: 'tool_execution',
  data: { ... },
  scores  // Braintrust aggregates and visualizes
})
```

### Benefits
- **Automatic quality metrics** without manual review
- **Regression detection** when scores drop
- **Performance baselines** for optimization
- **A/B testing** different strategies

## Performance Impact

| State | Overhead | Details |
|-------|----------|---------|
| **Disabled** | 0ms | All telemetry checks return immediately |
| **Enabled (current)** | <1ms per event | Plus network time (async, non-blocking) |
| **Enabled (with scoring)** | ~2-3ms per event | Additional scoring computation (async) |

The wrapper adds minimal overhead:
```typescript
if (!telemetry?.isEnabled()) {
  return originalFunc(input)  // Zero overhead when disabled
}
```

## Debugging

### Check if Working
```javascript
// Browser console
window.__BROWSEROS_TELEMETRY_ENABLED  // Should be true
```

### Common Issues

**No data in Braintrust?**
1. Verify API key in `config.ts`
2. Check console for: `✓ Telemetry ready (API key found)`
3. Look for `→ Tool:` messages in console
4. Ensure you rebuilt: `npm run build:dev`

**Missing tool executions?**
- Tools are only wrapped when `ENABLE_TELEMETRY = true` at build time
- Must rebuild after changing config

## Architecture Files

```
src/
├── config.ts                           # ENABLE_TELEMETRY & API key
├── evals/online/
│   ├── BraintrustEventCollector.ts    # Singleton collector
│   ├── EventEnricher.ts              # Adds rich context to events
│   └── createTrackedTool.ts           # Tool wrapper factory
├── lib/core/
│   └── NxtScape.ts                    # Creates parent session & EventEnricher
└── lib/agent/
    └── BrowserAgent.ts                # Wraps tools automatically
```

## Key Design Decisions

1. **Automatic Tool Wrapping**: No need to modify individual tools
2. **Lazy Initialization**: Telemetry only initializes when first used
3. **Zero Config**: Just set two flags in `config.ts`
4. **Privacy First**: All sensitive data automatically sanitized
5. **Non-Invasive**: When disabled, zero performance impact