# BrowserOS Agent Evaluation System Guide

This directory contains the development-only evaluation and experimentation system for the BrowserOS Agent, providing real-time telemetry for Braintrust, multi-dimensional scoring, and A/B testing capabilities for prompt optimization.

> **🧪 DEVELOPMENT ONLY**: This evaluation system is for internal testing and prompt optimization during development.

## Table of Contents
1. [Overview](#overview)
2. [Quick Start](#quick-start)
3. [Architecture](#architecture)
4. [Experimentation Workflow](#experimentation-workflow)
5. [Multi-Dimensional Scoring](#multi-dimensional-scoring)
6. [Performance Impact](#performance-impact)

## Overview

### Two Modes of Operation

The evaluation system operates in two distinct modes:

1. **Passive Logging Mode** (Always on when `ENABLE_TELEMETRY=true`)
   - Automatically logs all agent executions to Braintrust
   - Collects telemetry data for every task
   - Runs LLM scoring on task completion
   - No user intervention required
   - Builds up your dataset for future experiments

2. **Active Experimentation Mode** (Triggered by beaker button)
   - Requires tagged logs from passive mode as baseline
   - Replays previous tasks with your CURRENT local code
   - Compares baseline (v1) vs current code (v2) performance
   - Generates side-by-side comparisons in Braintrust
   - Used for A/B testing after making code/prompt changes

> **Important**: You must first collect logs in passive mode before you can run experiments. The passive mode builds your test dataset.

## Quick Start

### Prerequisites

- Braintrust API key configured
- OpenAI API key for LLM Judge scoring
- Access to Braintrust dashboard for tagging logs
- BrowserOS Agent extension loaded - Development build (`npm run build:dev`)

### 1. Configure API Keys (`src/config.ts`)

```typescript
export const ENABLE_TELEMETRY = true                    // ⚠️ WARNING: Agent execution will be logged (dev only), also enables experiments button in Header
export const BRAINTRUST_API_KEY = 'sk-...'             // Braintrust API key (required for telemetry)
export const BRAINTRUST_PROJECT_UUID = '49768a1a-...'  // Project UUID from Braintrust (required for experiments)
export const OPENAI_API_KEY_FOR_SCORING = 'sk-...'     // OpenAI API for LLM judge scoring
export const OPENAI_MODEL_FOR_SCORING = 'gpt-5'        // Model for scoring (gpt-5, gpt-5-mini, or gpt-5-nano)
```

### 2. Build in Development Mode

```bash
# Build extension in development mode
npm run build:dev

# Load extension in Chrome
# 1. Open chrome://extensions
# 2. Enable Developer Mode
# 3. Click "Load unpacked" → select 'dist' folder

# The experiment button appears in the sidepanel
# when both conditions are met: dev mode AND ENABLE_TELEMETRY = true
```

### 3. Collect Logs by Using the Agent

1. Open the Chrome extension side panel
2. Execute various tasks with the agent to generate logs
3. Each task execution is automatically logged to Braintrust
4. Build up a collection of representative test cases

### 4. Tag Logs in Braintrust

1. Navigate to [Braintrust Dashboard](https://app.braintrust.dev)
2. Open project: `browseros-agent-online`
3. Select logs you want as test cases
4. Add tag: `v1` (or any descriptive tag name)

### 5. Run Experiment

1. Open Chrome extension side panel
2. Click the 🧪 beaker icon in header (only visible when both dev mode + telemetry enabled)
3. Configure in the modal:
   - **Logs Tag**: `v1` (tag to fetch from Braintrust)
4. Click "Start Experiment"
5. Watch agent replay tasks
6. View results in Braintrust experiments

## Architecture

### Visual Flow Diagram

```
┌─────────────────────────── EVALUATION SYSTEM FLOW ───────────────────────────┐
│                                                                               │
│  User Query → NxtScape → BrowserAgent → Tool Execution                       │
│       ↓           ↓            ↓              ↓                              │
│  Start Session  Init      Tool Wrapping   Execute & Track                    │
│       ↓       Telemetry        ↓              ↓                              │
│       └───────────┴────────────┴──────────────┘                              │
│                        ↓                                                      │
│           BraintrustEventCollector (Singleton)                               │
│                        ↓                                                      │
│              [Telemetry Session Span]                                        │
│                   /    |    \                                                 │
│              task_1  task_2  task_3...                                       │
│                ↓       ↓       ↓                                             │
│            [Tool Spans with Metrics]                                         │
│                        ↓                                                      │
│              LLM Judge Scoring                                               │
│            (6 Quality Dimensions)                                            │
│                        ↓                                                      │
│              Braintrust Dashboard                                            │
│             (Logs & Experiments)                                             │
│                                                                               │
└───────────────────────────────────────────────────────────────────────────────┘
```

### Directory Structure

```
src/
├── evals/                              # Evaluation system (dev only)
│   ├── BraintrustEventCollector.ts    # Telemetry collection singleton
│   ├── ExperimentRunner.ts            # Core experiment logic and orchestration
│   ├── tool-wrapper.ts                # Automatic tool telemetry wrapper
│   └── scoring/
│       ├── LLMJudge.ts                # Multi-dimensional scoring engine
│       ├── LLMJudge.prompts.ts        # Scoring criteria and prompts
│       └── scoring-openai.ts          # Raw OpenAI client (no telemetry)
│
├── background/
│   └── index.ts                        # Chrome extension messaging & orchestration
│
├── sidepanel/components/
│   ├── ExperimentModal.tsx            # Experiment configuration UI
│   └── Header.tsx                      # Contains beaker button integration
│
└── lib/
    ├── core/
    │   └── NxtScape.ts                # Core agent with telemetry integration
    ├── agent/
    │   └── BrowserAgent.ts            # Agent with auto-wrapped tools
    └── runtime/
        └── ExecutionContext.ts        # Stores and telemetry reference
```

### Integration Points

```typescript
// Tool Wrapping (BrowserAgent._processToolCalls)
if (this.executionContext.telemetry?.isEnabled() && this.executionContext.parentSpanId) {
  const wrappedTool = createTrackedTool(tool, this.executionContext)
  toolFunc = wrappedTool.func
}

// Session Management (NxtScape)
if (!this.telemetrySessionId) {
  await this._initializeTelemetrySession()
  this.telemetry = BraintrustEventCollector.getInstance()
}

// Single LLM scoring with dual logging (NxtScape._finalizeTask)
const judge = new LLMJudge()
const result = await judge.scoreTaskCompletionWithContext(
  query,
  this.executionContext,
  { outcome: outcome, duration_ms: taskDuration }
)

// Log to telemetry (always)
await this.telemetry.logEvent(event, { parent: this.telemetryParentSpan })

// Also log to experiment if in experiment mode
if (this.experimentId && BRAINTRUST_API_KEY) {
  await fetch('https://api.braintrust.dev/v1/insert', {
    body: JSON.stringify({
      experiment: { [this.experimentId]: { events: [experimentEvent] } }
    })
  })
}
```

### Hybrid Architecture Design

To avoid webpack chunk conflicts, we use a hybrid approach:

**`src/background/index.ts`** - Chrome extension orchestration (runs in service worker)
- Contains `handleRunExperimentPort()` function
- Handles Chrome port messaging and progress updates
- Development mode checks and error handling
- Orchestrates calls to ExperimentHelper methods
- Stays in service worker context to avoid DOM issues

**`src/evals/ExperimentRunner.ts`** - Core experiment logic
- `ExperimentHelper` class with static methods:
  - `fetchAvailableTags()` - Fetches and counts tags from Braintrust logs
  - `fetchAndValidateLogs()` - Validates logs exist for given tag with helpful errors
  - `createExperiments()` - Creates v1 (baseline) and v2 (new) experiments
  - `runSingleTest()` - Executes single test with NxtScape (no duplicate scoring)
- Helper methods for BTQL queries and data formatting
- Handles all Braintrust API interactions
- Passes `experimentId` to NxtScape for dual logging (telemetry + experiment)
- Regular import from background script (no chunk conflicts)

This separation ensures webpack doesn't bundle UI components with service worker code while keeping all experiment business logic centralized and reusable.

### Tool Wrapping & Telemetry

The evaluation system automatically wraps all tools with telemetry tracking:

#### How Tool Wrapping Works

1. **Automatic Wrapping** (`BrowserAgent._processToolCalls`)
   ```typescript
   // Tools are dynamically wrapped when telemetry is active
   if (this.executionContext.telemetry?.isEnabled() && this.executionContext.parentSpanId) {
     const wrappedTool = createTrackedTool(tool, this.executionContext)
     toolFunc = wrappedTool.func
   }
   ```

2. **What Gets Tracked** (`tool-wrapper.ts`)
   - **Execution Duration**: Time taken for tool to complete (milliseconds)
   - **Success/Failure**: Whether tool returned `ok: true` or `ok: false`
   - **Error Counts**: Aggregated per tool type across the session
   - **Tool Arguments**: Input parameters (stored in MessageManager)
   - **Tool Results**: Output data (stored in MessageManager)

3. **Error Aggregation**
   - Tool errors are counted per session
   - Both logical errors (`ok: false`) and runtime exceptions tracked
   - Session summary shows total errors per tool type
   - Error metrics help identify problematic tools

4. **Span Creation**
   - Each tool execution creates a child span under the task
   - Uses Braintrust's `wrapTraced` for proper trace visualization
   - Tool spans include metrics, metadata, and error information
   - Failed tools create additional error events for visibility

## Experimentation Workflow

### Dual Logging Architecture

The evaluation system uses a **dual logging approach** to eliminate duplicate LLM scoring:

**Normal Usage (No Experiment)**
- NxtScape created without `experimentId`
- Scores once → goes to logs only (initLogger)
- No experiment data created

**During Experiments**
- NxtScape created with `experimentId: v2ExperimentId`
- Scores once → logs to BOTH:
  - Telemetry (initLogger) - for monitoring
  - Experiment - for A/B comparison
- Same exact scores in both places

### Key Data Flows

```
Logging Flow (Real-time telemetry):
  User Query → Agent Execution → Single LLM Score → initLogger → Braintrust Dashboard (Logs)

Experimentation Flow (A/B testing with dual logging):
  Tagged Dataset → Experiment Runner → NxtScape (with experimentId) → Single LLM Score → Both:
    ├─ initLogger (telemetry)
    └─ Experiment (via experimentId)
```

### Event Hierarchy

```
agent_session (parent span)
  ├─ Task 1: "Find headphones"
  │  ├─ task_1_start (event)
  │  ├─ tool:classification_tool (span with metrics)
  │  ├─ tool:planner_tool (span with metrics)
  │  ├─ tool:navigation_tool (span with metrics)
  │  └─ task_1_success (event with multi-dimensional scores)
  └─ Task 2: "Filter results"
     └─ ...
```

### Step-by-Step Process

#### 1. **Collect Development Data**
- Enable telemetry in development environment
- Run agent with real tasks to collect logs
- All executions logged to Braintrust with telemetry
- Multi-dimensional scores attached to each task
- Logs automatically sent to Braintrust with scores

#### 2. **Create Test Dataset**
As a developer, curate your test cases:
- Open [Braintrust dashboard](https://app.braintrust.dev)
- Browse logs in project `browseros-agent-online`
- Select interesting/problematic cases
- Tag them (e.g., `v1`, `baseline-navigation`, `error-cases`, `complex-tasks`)
- These tagged logs become your reusable dataset for experimenting
- Tags become your baseline for comparison

#### 3. **Modify Agent Code**
Make improvements to agent behavior:
- Edit prompts or logic in your local codebase:
  - `BrowserAgent.prompt.ts` - Main agent prompts
  - `PlannerTool.prompt.ts` - Planning prompts
  - `ClassificationTool.prompt.ts` - Task classification
  - Other tool prompts as needed
  - Any agent logic changes in `BrowserAgent.ts`, tool implementations, etc.

> **Note**: The experiment will use whatever code is currently in your local environment. If you haven't made any changes, the "new" (v2) results will be identical to the baseline (v1).

#### 4. **Run Experiment**
Execute the experiment from the sidepanel:
1. Open Chrome extension side panel
2. Click the **🧪 beaker/experiment button** (visible when dev mode + telemetry enabled)
3. Configure in the modal dialog:
   - **Logs Tag**: `v1` (fetches v1 tagged logs as baseline)
   - **Max Logs**: Number to test (default: 10, use 2 for quick iteration)
4. Click "Start Experiment"

The experiment will:
- Fetch logs tagged with your specified tag from Braintrust
- Create two separate experiments:
  - `v1(baseline)--2025-08-22-19:30` - Original scores from when logs were collected
  - `v1(new)--2025-08-22-19:30` - New execution scores with your current local code
- Re-run each test using your current local codebase with `experimentId` set
- Score ONCE with LLM Judge and log to BOTH telemetry and experiment
- Create a Braintrust comparison between baseline (v1) vs current code (v2)
- No duplicate LLM calls - same scores go to both destinations

#### Fresh State Between Tests

**Each test runs in complete isolation** to ensure accurate results:

**Cleanup Process:**

1. **Chrome Storage**
   - Local storage cleared
   - Session storage cleared  
   - Sync storage cleared
   - Verification that storage is empty

2. **Singleton Instances**
   - BraintrustEventCollector reset (internal state cleared)
   - StorageManager cache cleared

3. **Browser State**
   - All tabs closed, fresh new tab created
   - Tabs closed in batches to avoid overwhelming Chrome
   - New tab activated and ready

4. **Verification**
   - Storage verified empty after cleanup
   - Brief 300ms stabilization delay

**Cleanup Timing:**
- **Pre-test cleanup**: Runs before the first test to ensure clean initial state
- **Post-test cleanup**: Runs after EVERY test in the `finally` block
- **Verification step**: Confirms storage is empty after cleanup

**How It Works:**
1. Test completes and scores are sent to Braintrust
2. Cleanup runs (`performCompleteCleanup()`):
   - Clears all Chrome storage
   - Resets singleton instances
   - Creates fresh browser environment
   - Verifies cleanup was successful
   - Waits 300ms for Chrome to stabilize
3. Next test starts with completely fresh state

This ensures each test behaves with no contamination from previous tests. The cleanup is logged to the console for debugging.


#### 5. **Compare Results**
Review results in Braintrust (Experiments):
- Compare scores (original vs new)
- In the Braintrust UI (Experiments), you'll see:
  - Side-by-side diffs of expected (v1) vs actual (v2) outputs
  - Score improvements or regressions between versions
  - Success rate changes across all test cases
- Identify regressions and improvements

#### 6. **Iterate**
- Analyze what improved/regressed
- Adjust prompts based on findings
- Re-run experiment
- Repeat until satisfied

## Multi-Dimensional Scoring

### How Scoring Works

The LLM Judge (`LLMJudge.ts`) evaluates task completion using the full execution context:

#### Context Building
The scorer builds a comprehensive context from `ExecutionContext`:
- **Message History**: Complete conversation between user and agent
- **Tool Executions**: All tool calls with arguments and results
- **Browser States**: URL and title changes throughout execution
- **TODO Progress**: Task plan and completion status
- **Tool Retries**: Count of retry attempts per tool
- **Current State**: Final page URL and title
- **Token Count**: Total tokens used in conversation

#### Scoring Process
1. **Context Extraction**: `buildFullContext()` pulls data directly from ExecutionContext stores
2. **Prompt Generation**: Full untruncated context sent to LLM Judge (can be 10,000+ tokens)
3. **LLM Evaluation**: OpenAI model evaluates across 6 dimensions
4. **Score Calculation**: Weighted average computed from dimension scores
5. **Console Output**: Color-coded scores displayed (purple for v1, darker purple for v2)

#### Fallback Behavior
- If OpenAI key missing: Returns fallback score of `-1.0`
- If parsing fails: Returns `-1.0` with error details
- Missing dimensions: Default to `0.5` (middle score)

### Scoring Dimensions & Weights

| Dimension | Weight | Description | Scoring Focus |
|-----------|--------|-------------|---------------|
| **Goal Achievement** | 40% | Did agent achieve user's goal? | Result communication crucial |
| **Execution Quality** | 20% | Quality of steps and decisions | Tool selection, navigation accuracy |
| **Execution Precision** | 15% | Efficiency without unnecessary retries | Minimal redundant actions |
| **Progress Made** | 10% | Forward movement toward goal | Partial credit for incomplete tasks |
| **Plan Coherence** | 8% | Logical flow and planning | Sensible step sequencing |
| **Error Handling** | 7% | Recovery from failures | Graceful degradation |
| **Success** | Binary | Task completed (1) or not (0) | Pass/fail metric |
| **Weighted Total** | Calculated | Weighted average of all dimensions | Overall quality score |

### Score Interpretation

- `0.90-1.00` = Excellent execution
- `0.70-0.89` = Good with minor issues  
- `0.50-0.69` = Acceptable but needs improvement
- `0.30-0.49` = Poor execution
- `0.00-0.29` = Failed badly

### Visual Feedback

Console logs use color coding:
- **Purple** (#9c27b0) - LLM scoring output (single call, dual logged)


### Experiment Execution Flow

```
User clicks beaker button
    ↓
Header.tsx sends RUN_EXPERIMENT message
    ↓
background/index.ts:handleRunExperimentPort()
    ├─ Import API keys and ExperimentHelper
    ├─ Send progress updates via Chrome port
    ├─ ExperimentHelper.fetchAndValidateLogs()
    │   ├─ Fetch tagged logs from Braintrust (BTQL API)
    │   └─ Validate logs exist (or show available tags)
    ├─ ExperimentHelper.createExperiments()
    │   ├─ Create v1 baseline experiment
    │   ├─ Create v2 new experiment
    │   └─ Generate comparison URLs
    └─ For each log:
        └─ ExperimentHelper.runSingleTest()
            ├─ Dynamic import NxtScape with experimentId
            ├─ Run task with current code
            ├─ NxtScape scores ONCE with LLM Judge
            ├─ NxtScape logs to BOTH telemetry AND experiment
            ├─ Fetch v1 scores from decision spans
            └─ Log v1 baseline to v1 experiment
    ↓
Send completion message with URLs
    ↓
Log comparison URL to console
```


### API Endpoints Used

| Endpoint | Method | Purpose | Used By |
|----------|--------|---------|---------|
| `/btql` | POST | Query logs with BTQL | `ExperimentHelper.fetchAndValidateLogs()`, `fetchAvailableTags()` |
| `/v1/experiment` | POST | Create experiments | `ExperimentHelper.createExperiments()` |
| `/v1/insert` | POST | Log experiment events | `ExperimentHelper.runSingleTest()` |

## Performance Impact

### When Disabled
- **Zero overhead** - All telemetry code skipped
- No Braintrust API calls
- No scoring computations

### When Enabled

| Operation | Overhead | Details |
|-----------|----------|---------|
| **Telemetry collection** | <1ms per event | Async, non-blocking |
| **LLM scoring** | ~2-3s per task | OpenAI API call |
| **Experiment run** | ~30-60s per log | Full agent execution |
| **API calls** | ~100-200ms each | Network latency |

### Optimization Strategies

1. **Limit test dataset size** - Use `maxLogs` parameter
2. **Tag specific scenarios** - Don't test everything
3. **Run experiments locally** - No production impact
4. **Use cheaper scoring model** - `gpt-5-mini` or `gpt-5-nano` vs `gpt-5`

## Troubleshooting

**No data in Braintrust?**
- Verify `ENABLE_TELEMETRY = true`
- Check `BRAINTRUST_API_KEY` is set
- Verify `BRAINTRUST_PROJECT_UUID` matches your project
- Rebuild after config changes: `npm run build:dev`

**No scores appearing?**
- Verify `OPENAI_API_KEY_FOR_SCORING` is valid
- Check `OPENAI_MODEL_FOR_SCORING` (gpt-5, gpt-5-mini, or gpt-5-nano)
- Ensure task completes (not interrupted)
- Update OpenAI npm package to latest: `npm install openai@latest`

**GPT-5 API Compatibility Notes:**
- GPT-5 requires `max_completion_tokens` instead of `max_tokens`
- GPT-5 only supports default temperature (1.0) - cannot be set to 0
- GPT-5 needs more tokens for scoring (~400-500 minimum, configured for 3000)
- Ensure OpenAI package is v5.x or later for GPT-5 support

### Configuration Checklist

- [ ] `ENABLE_TELEMETRY = true`
- [ ] `BRAINTRUST_API_KEY` set
- [ ] `OPENAI_API_KEY_FOR_SCORING` set
- [ ] `OPENAI_MODEL_FOR_SCORING` configured
- [ ] `BRAINTRUST_PROJECT_UUID` set (if using experiment)
- [ ] `npm run build:dev` (not production)
- [ ] Chrome extension reloaded
- [ ] Logs tagged in Braintrust

