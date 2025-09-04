---
date: 2025-09-04T10:00:00-08:00
researcher: Claude Code
git_commit: 16e091db20ab1c17354729c34bef5ed75a1a200c
branch: dev/evals2
repository: BrowserOS-agent
topic: "Braintrust Evaluation System Implementation"
tags: [research, codebase, braintrust, telemetry, evaluation, llm-judge, experiments]
status: complete
last_updated: 2025-09-04
last_updated_by: Claude Code
---

# Research: Braintrust Evaluation System Implementation

**Date**: 2025-09-04T10:00:00-08:00  
**Researcher**: Claude Code  
**Git Commit**: 16e091db20ab1c17354729c34bef5ed75a1a200c  
**Branch**: dev/evals2  
**Repository**: BrowserOS-agent

## Research Question
Thoroughly research and understand how the Braintrust evaluation system is currently implemented in this codebase, including telemetry, tool wrapping, scoring, and experiment running.

## Summary
The Braintrust evaluation system in BrowserOS-agent is a comprehensive telemetry and evaluation framework that tracks agent execution in real-time, scores task completion using an LLM judge, and enables A/B testing experiments. The system uses a singleton telemetry collector with lazy initialization, dynamic tool wrapping with Braintrust's `wrapTraced`, multi-dimensional scoring via OpenAI, and a replay mechanism for comparing different agent versions.

## Detailed Findings

### 1. Telemetry System Architecture

#### BraintrustEventCollector (`src/evals/BraintrustEventCollector.ts`)
- **Singleton Pattern**: Single instance across the entire application via `getInstance()`
- **Lazy Initialization**: Telemetry only initializes when first used AND when `ENABLE_TELEMETRY=true`
- **Session Management**: Creates parent spans for conversation sessions containing multiple tasks
- **Event Types**: Tracks `session_start`, `session_end`, `tool_execution`, `decision_point`, `error`, `browser_action`, `user_feedback`
- **Dual Logging**: Can log to both telemetry logger AND experiments simultaneously

Key implementation details:
```typescript
// Lazy initialization pattern - checks on every public method
private async _ensureInitialized(): Promise<void> {
  if (this.initialized) return;
  this.initialized = true;
  this.enabled = this._checkIfEnabled();
  if (this.enabled) {
    await this._initialize();
  }
}

// Session tracking with parent-child span relationships
async startSession(metadata: SessionMetadata): Promise<{ parent?: string }> {
  const parent = await this.logger.traced(async (span: any) => {
    span.log({
      input: validatedMetadata.task,
      metadata: { sessionId, timestamp, tabContext, browserInfo }
    })
    return await span.export()
  }, { name: 'agent_session' })
  return { parent }
}
```

#### Integration in NxtScape (`src/lib/core/NxtScape.ts`)
- **Deferred Initialization**: Telemetry session only starts on first task (not on extension open)
- **Task Tracking**: Each task gets a `task_N_start` and `task_N_[success|error|paused]` event
- **Score Aggregation**: Tracks `weighted_total` scores across tasks for session average
- **Dual Logging**: When `experimentId` is provided, logs to both telemetry AND experiment

### 2. Tool Telemetry Wrapping

#### createTrackedTool (`src/evals/tool-wrapper.ts`)
- **Dynamic Wrapping**: Tools are wrapped at execution time, not at creation
- **Braintrust Integration**: Uses Braintrust's `wrapTraced` for automatic span creation
- **Metrics Tracking**: Duration, success/failure, error counts
- **Error Handling**: Distinguishes between "soft errors" (tool returns `{ok: false}`) and exceptions

```typescript
export function createTrackedTool(tool: DynamicStructuredTool, context: ExecutionContext): DynamicStructuredTool {
  const wrapTraced = telemetry.getWrapTraced()
  if (!wrapTraced) return tool
  
  const trackedFunc = wrapTraced(
    async (input: any, span: any) => {
      const startTime = performance.now()
      try {
        const result = await originalFunc(input)
        // Check for soft errors (ok: false)
        const parsedResult = JSON.parse(result)
        if (!parsedResult.ok) {
          // Log as error with structured format for Braintrust
          span.log({
            error: { name: 'Tool error', message: errorMessage },
            metrics: { duration_ms, success: 0 },
            logs: { 'Tool errors': [errorDetails] }
          })
        }
      } catch (error) {
        // Handle exceptions differently
      }
    },
    { type: 'tool', name: toolName, parent: context.parentSpanId }
  )
}
```

#### Integration in BrowserAgent
- Tools are wrapped conditionally when telemetry is enabled
- Wrapping happens just before tool execution to capture current context

### 3. LLMJudge Scoring System

#### LLMJudge (`src/evals/scoring/LLMJudge.ts`)
- **Multi-Dimensional Scoring**: 6 dimensions with weighted average
- **Score Dimensions**:
  - `goal_achievement` (40% weight) - Did we achieve the user's goal?
  - `execution_quality` (20% weight) - Quality of execution steps
  - `execution_precision` (15% weight) - No unnecessary retries
  - `progress_made` (10% weight) - Amount of progress toward goal
  - `plan_coherence` (8% weight) - Logic of the plan
  - `error_handling` (7% weight) - How errors were handled

- **Full Context Access**: Directly accesses ExecutionContext stores (MessageManager, TodoStore, BrowserContext)
- **OpenAI Integration**: Uses raw OpenAI client (not wrapped) to avoid creating separate spans

```typescript
async scoreTaskCompletionWithContext(
  userTask: string,
  executionContext: ExecutionContext,
  taskOutcome?: { outcome: 'success' | 'error' | 'paused', duration_ms: number }
): Promise<JudgeResult> {
  // Build full context from ExecutionContext
  const fullContext = await this.buildFullContext(executionContext, taskOutcome)
  
  // Get multi-dimensional scoring prompt
  const prompt = getMultiDimensionalScoringPrompt(userTask, fullContext)
  
  // Score with OpenAI
  const completion = await scoringOpenAI.chat.completions.create({
    model: this.model,
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' }
  })
  
  // Calculate weighted average
  const weightedTotal = calculateWeightedAverage(dimensionScores)
  return { score: weightedTotal, scores: dimensionScores, scoringDetails }
}
```

### 4. Experiment Runner

#### ExperimentHelper (`src/evals/ExperimentRunner.ts`)
- **Replay Mechanism**: Fetches historical logs tagged with version (e.g., "v1") and replays them
- **Baseline Comparison**: Creates two experiments - baseline (v1) and new (v2)
- **BTQL Queries**: Uses Braintrust Query Language to fetch logs by tag
- **Child Span Analysis**: Fetches child spans to find decision points with scores
- **Complete Cleanup**: Between tests, clears Chrome storage, resets singletons, closes tabs

```typescript
static async runSingleTest(log: any, index: number, v1ExperimentId: string, v2ExperimentId: string): Promise<Result> {
  // Cleanup before test
  await this.performCompleteCleanup()
  
  // Run test with v2 code
  const experimentNxtScape = new NxtScape({ 
    experimentId: v2ExperimentId  // Enables dual logging
  })
  await experimentNxtScape.run({ query: log.input })
  
  // Fetch v1 scores from historical data
  const decisionSpan = await this.fetchDecisionSpan(log, apiKey)
  const v1Scores = this.extractV1Scores(decisionSpan)
  
  // Log both v1 and v2 to experiments for comparison
  // v1 uses historical scores, v2 uses new execution scores
}

private static async performCompleteCleanup(): Promise<void> {
  // Clear Chrome storage
  await chrome.storage.local.clear()
  await chrome.storage.session.clear()
  
  // Reset singleton instances
  BraintrustEventCollector.getInstance().reset()
  
  // Close all tabs and create fresh one
  const newTab = await chrome.tabs.create()
  await closeAllOtherTabs()
}
```

### 5. Data Flow

#### User Interaction → Braintrust Flow:
1. **User Query** → Side Panel → Background Script → `NxtScape.run()`
2. **Session Start** → `BraintrustEventCollector.startSession()` creates parent span
3. **Task Start** → `NxtScape._finalizeTask()` logs `task_N_start` event
4. **Tool Execution** → `createTrackedTool()` wraps tool → logs metrics via `wrapTraced`
5. **LLM Scoring** → `LLMJudge.scoreTaskCompletionWithContext()` → multi-dimensional scores
6. **Task End** → `NxtScape._finalizeTask()` logs `task_N_[outcome]` with scores
7. **Session End** → `BraintrustEventCollector.endSession()` with aggregated scores

#### Key Data Structures:
```typescript
// Event structure sent to Braintrust
{
  type: 'decision_point',
  name: 'task_1_success',
  data: { task, duration_ms, success, phase },
  scores: {
    goal_achievement: 0.9,
    execution_quality: 0.8,
    weighted_total: 0.85,
    task_completed: 1.0
  },
  scoring_details: { /* LLM response details */ },
  error: { name, message, stack }  // If error occurred
}
```

### 6. Configuration and Setup

#### Environment Variables (`src/config.ts`):
- `ENABLE_TELEMETRY=true` - Master switch for telemetry
- `BRAINTRUST_API_KEY` - Required for logging to Braintrust
- `OPENAI_API_KEY_FOR_SCORING` - Required for LLM scoring
- `OPENAI_MODEL_FOR_SCORING` - Model for scoring (default: gpt-4o)
- `BRAINTRUST_PROJECT_UUID` - Required for experiments

#### Braintrust Project Setup:
- Project name: `browseros-agent-online`
- Organization: `Felafax`
- Dashboard: `https://braintrust.dev/app/Felafax/p/browseros-agent-online`

### 7. Key Design Patterns

#### Singleton Pattern with Lazy Initialization
- `BraintrustEventCollector` uses singleton to ensure one instance
- Lazy initialization prevents overhead when telemetry is disabled
- Allows environment variables to be set after construction

#### Decorator Pattern for Tool Telemetry
- Tools are wrapped dynamically at execution time
- Preserves original tool functionality while adding telemetry
- Uses Braintrust's `wrapTraced` for proper span creation

#### Parent-Child Span Relationships
- Conversation session is parent span
- Individual tasks are child spans
- Tool executions are grandchild spans
- Creates hierarchical trace visualization in Braintrust

#### Dual Logging Pattern
- Normal execution logs to telemetry logger (`initLogger`)
- Experiment mode logs to BOTH telemetry AND experiment
- Enables A/B testing without losing regular telemetry

## Architecture Insights

### Why Tools are Wrapped Dynamically
1. **Context Availability**: Execution context (parent span, session ID) is only available at runtime
2. **Performance**: Avoids wrapping tools that won't be used
3. **Flexibility**: Different tools can be wrapped differently based on context

### Score Aggregation Strategy
- Individual tasks get multi-dimensional scores
- Session success = average of all task `weighted_total` scores
- Allows partial credit for incomplete sessions
- Preserves detailed scoring for analysis

### Experiment Isolation
- Complete cleanup between tests (storage, tabs, singletons)
- Each test runs in fresh environment
- Prevents state leakage between experiments

## Code References
- `src/evals/BraintrustEventCollector.ts:69-190` - Singleton initialization with lazy loading
- `src/evals/tool-wrapper.ts:38-227` - Dynamic tool wrapping with wrapTraced
- `src/evals/scoring/LLMJudge.ts:256-426` - Full context scoring implementation
- `src/evals/ExperimentRunner.ts:857-949` - Single test execution with cleanup
- `src/lib/core/NxtScape.ts:531-617` - Session management and score aggregation
- `src/lib/core/NxtScape.ts:619-817` - Task finalization with dual logging
- `src/background/index.ts:72-208` - Experiment UI integration

## Historical Context (from thoughts/)
No existing research documents found specifically about the Braintrust evaluation system. This appears to be a relatively new feature addition to the codebase.

## Related Research
- None found in `thoughts/shared/research/` directory related to evaluation systems

## Issues and Inefficiencies Identified

### 1. **Complex Initialization Chain**
- Telemetry initialization is spread across multiple files
- Lazy initialization pattern is complex and could be simplified
- Environment variable checking happens in multiple places

### 2. **Score Format Inconsistency**
- Multiple score field names (`success`, `task_completion`, `task_completed`)
- Score normalization logic duplicated in multiple places
- Confusion between session scores and task scores

### 3. **Error Handling Complexity**
- Different error formats for tools vs execution errors
- Error tracking duplicated between telemetry and scoring
- Structured error format not consistently applied

### 4. **Tight Coupling**
- `NxtScape` directly imports and uses `BraintrustEventCollector`
- LLM Judge directly accesses ExecutionContext internals
- Experiment runner has hardcoded cleanup logic

### 5. **Performance Overhead**
- Full context extraction for every scoring call
- Multiple API calls for experiment replay
- No caching of scores or context

## Suggestions for Cleaner Reimplementation

### 1. **Unified Telemetry Interface**
Create a clean `TelemetryService` interface that abstracts Braintrust implementation:
```typescript
interface TelemetryService {
  startSession(metadata: SessionMetadata): Promise<string>
  logEvent(event: TelemetryEvent): Promise<void>
  endSession(sessionId: string, result: SessionResult): Promise<void>
  wrapTool(tool: Tool): Tool
}
```

### 2. **Standardized Score Schema**
Use consistent Zod schemas for all scores:
```typescript
const ScoreSchema = z.object({
  goal_achievement: z.number().min(0).max(1),
  execution_quality: z.number().min(0).max(1),
  // ... other dimensions
  weighted_total: z.number().min(0).max(1)
})
```

### 3. **Event Bus for Telemetry**
Use existing PubSub system for telemetry events instead of direct coupling:
```typescript
PubSub.publish('telemetry:task:start', { task, context })
PubSub.publish('telemetry:tool:execute', { tool, input, output })
```

### 4. **Separate Scoring Service**
Extract scoring into independent service with clear interface:
```typescript
interface ScoringService {
  scoreTask(task: string, context: TaskContext): Promise<Scores>
  aggregateScores(scores: Scores[]): number
}
```

### 5. **Configuration Service**
Centralize all telemetry configuration:
```typescript
class TelemetryConfig {
  private static instance: TelemetryConfig
  
  isEnabled(): boolean
  getApiKey(): string
  getScoringModel(): string
  getProjectId(): string
}
```

### 6. **Simplified Experiment Runner**
- Use factory pattern for creating test environments
- Extract cleanup logic into reusable utilities
- Use async iterators for test execution

### 7. **Type Safety Improvements**
- Use branded types for IDs (SessionId, SpanId, ExperimentId)
- Use discriminated unions for events
- Add runtime validation for all external data

## Open Questions
1. Why is telemetry initialization deferred until first task instead of on extension start?
2. How are tool error counts used beyond logging?
3. Why does experiment mode use dual logging instead of just experiment logging?
4. What determines the weights for multi-dimensional scoring?
5. How is the Braintrust project UUID determined/configured?
6. Why use raw OpenAI client for scoring instead of wrapped version?
7. What's the purpose of tracking `tool_success_rate` in session end?