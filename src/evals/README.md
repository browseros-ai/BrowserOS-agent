# BrowserOS Agent Evaluation System

## Overview

Evaluation system for the BrowserOS agent with:
- **Online Telemetry**: Seamless, automatic agent/tool tracking via Braintrust SDK (only used in dev environments)
- **Offline Tests**: Standalone unit tests for specific tools

## Directory Structure

```
src/evals/
├── online/                           # Online telemetry system (only used in dev environments)
│   ├── BraintrustEventCollector.ts  # Singleton collector with lazy init
│   ├── EventEnricher.ts             # Automatic context enrichment
│   ├── createTrackedTool.ts        # Tool wrapper factory
│   └── README.md                     # Detailed telemetry guide
│
├── offline/                          # Offline test suites
│   └── tools/                       # Tool-specific unit tests
│       ├── planner/                 # Planner tool tests
│       └── validator/               # Validator tool tests
│
└── shared/                          # Shared utilities
    └── push-prompts.ts             # Extract prompts to JSON (Planned)
```

## Quick Start - Online Telemetry

### Automatic Tool Tracking

When telemetry is enabled, BrowserAgent automatically wraps every tool with tracking:

```typescript
// Just set these flags in src/config.ts:
export const ENABLE_TELEMETRY = true;
export const BRAINTRUST_API_KEY = 'your-key';

// That's it! All tools now have telemetry.
```

### How It Works

1. **User query** → NxtScape creates parent session
2. **EventEnricher** → Created with ExecutionContext for rich data access
3. **BrowserAgent** → Automatically wraps all tools with `createTrackedTool()`
4. **Tool execution** → Wrapper logs start/end/errors with timing
5. **Event enrichment** → EventEnricher automatically adds context to all events
6. **Braintrust SDK** → Batches and sends enriched data
7. **Dashboard** → View traces with full context at braintrust

### What Gets Logged

```
Conversation Session
└── Task: "Find headphones"
    ├── classification_tool (234ms) ✓
    ├── planner_tool (456ms) ✓
    ├── navigate_tool (89ms) ✓
    ├── extract_tool (123ms) ✓
    └── done_tool (45ms) ✓
```

Each tool execution includes:
- **Input** (automatically captured by wrapTraced)
- **Output** (automatically captured by wrapTraced)
- **Duration** in milliseconds
- **Success/failure** status
- **Rich context** via EventEnricher:
  - Conversation history (last 3 messages)
  - Current plan and progress
  - Browser state (URL, title, tabs)
  - Original user intent

### Build & Run

```bash
npm run build:dev
# Reload extension in Chrome
```

View data in Braintrust dashboard → `browseros-agent-online` project

### Offline Evaluations (Existing)

Run standalone test suites:

```bash
# Tool-specific tests
npm run eval:planner     # Test planner tool
npm run eval:validator   # Test validator tool

# Extract prompts for version control
npm run extract:prompts
```

## Implementation Status

### ✅ Phase 1: Infrastructure (COMPLETE)
- Development telemetry using `initLogger` ✅
- Parent/child span relationships ✅
- Automatic LLM tracking with `wrapOpenAI` ✅
- SDK-managed batching ✅
- Simple env var activation ✅

### ✅ Phase 2: Integration (COMPLETE)
- Connected to BrowserAgent ✅
- Classification tracking ✅
- Tool tracking via wrappers ✅
- Plan generation tracking ✅
- Session lifecycle management ✅

### ✅ Phase 3: Enhanced Data Collection (COMPLETE)
- EventEnricher adds rich context ✅
- Conversation history tracking ✅
- Plan state tracking ✅
- Browser state capture ✅
- All tools automatically wrapped ✅
- Decision points tracked ✅
- Browser actions tracked ✅

### 🎯 Phase 4: LLM-as-Judge Scoring (NEXT ITERATION)
#### Implementation Roadmap
1. **Tool-Level Scoring** (`scoringHelpers.ts`)
   - Performance scoring based on execution time
   - Success detection from tool outputs
   - Quality assessment for specific tools (planner, validator)

2. **Task-Level Scoring** (in `NxtScape.ts`)
   - Overall task success
   - Efficiency metrics
   - Complexity handling assessment

3. **Integration with Braintrust**
   - Add scores to telemetry events
   - Update `BraintrustEventCollector` to handle scores
   - Modify `createTrackedTool` wrapper to calculate scores

4. **Dashboard & Analysis**
   - Score visualization in Braintrust
   - Regression detection alerts
   - Performance baselines

## Current State

**✅ COMPLETE:** Enhanced telemetry data collection is fully implemented and working.

### What's Implemented
- ✅ **Automatic tool wrapping** - All tools tracked when enabled
- ✅ **Rich context** - Conversation history, plan state, browser info via EventEnricher
- ✅ **Decision tracking** - Classification and planning decisions captured
- ✅ **Browser actions** - Navigation, clicks, scrolls tracked via wrapped tools
- ✅ **Zero overhead** - No impact when disabled
- ✅ **Simple activation** - Just set `ENABLE_TELEMETRY = true` in config.ts

### What You Get
Every tool execution includes:
- Input/output (sanitized)
- Duration metrics
- Success/failure status
- Conversation context (last 3 messages)
- Current plan and progress
- Browser state (URL, title, tab count)

## Best Practices

1. **Online**: Enable only when needed (performance impact)
2. **Offline**: Run before commits to catch regressions
3. **Privacy**: Never log sensitive user data
4. **Versioning**: Extract prompts after changes


## Next Steps

1. **For developers**: 
   - Set `ENABLE_TELEMETRY = true` in config.ts when debugging
   - View your data at braintrust
   - Run offline tests before PRs

2. **For analysis**: 
   - Query Braintrust dashboard for patterns
   - Identify slow tools and optimize
   - Debug complex execution flows

## How It Works

The telemetry is already integrated! When you enable it in config.ts:

1. **NxtScape** creates a conversation-level session
2. **BrowserAgent** tracks:
   - Task classification (simple vs complex)
   - Plan generation for complex tasks  
   - Tool execution with timing
   - Success/failure outcomes
3. **Tools** are automatically wrapped with telemetry
4. **Data flows** to Braintrust for analysis

No additional setup needed - just set the flags in config.ts!

## Understanding the Scoring Architecture (Planned)

### Key Concept: Local Scoring, Remote Aggregation

Unlike some evaluation systems, Braintrust doesn't automatically score your agent. Instead:

1. **You define what "good" means** in your code
2. **Calculate scores locally** during execution
3. **Send scores to Braintrust** with telemetry events
4. **Braintrust aggregates and visualizes** your scores

### Example Flow (Coming Soon)

```typescript
// 1. Tool executes
const result = await plannerTool.execute(input)

// 2. Local scoring logic (you define this)
const scores = {
  performance: duration < 500 ? 1.0 : 0.5,       // Fast = good
  success: result.ok ? 1.0 : 0.0,                // OK = success
  plan_quality: evaluatePlanCoherence(result),   // Custom LLM scoring
}

// 3. Send to Braintrust
await telemetry.logEvent({
  type: 'tool_execution',
  name: 'planner_tool',
  data: { input, output, duration },
  scores: scores  // ← Your pre-calculated scores
})

// 4. Braintrust shows aggregated metrics
// - Average scores across runs
// - Score distributions
// - Trends over time
// - Comparisons between experiments
```

This approach gives you complete control over your evaluation metrics while leveraging Braintrust's powerful aggregation and visualization capabilities.
