# Current Evaluation System Architecture

## 1. System Overview

The BrowserOS Agent evaluation system is a comprehensive telemetry and experimentation framework built on Braintrust for measuring and improving agent performance through real-world usage data and controlled experiments.

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     User Interaction                         │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                    NxtScape.run()                           │
│  - Initializes telemetry session (lazy)                     │
│  - Tracks task lifecycle                                    │
│  - Orchestrates BrowserAgent                               │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                   BrowserAgent.execute()                    │
│  - Wraps tools with telemetry dynamically                   │
│  - Executes classification → planning → tools               │
│  - Manages conversation flow                                │
└──────────────────────┬──────────────────────────────────────┘
                       │
         ┌─────────────┴─────────────┬─────────────┐
         ▼                           ▼             ▼
┌──────────────────┐      ┌──────────────────┐  ┌──────────────────┐
│ createTrackedTool│      │  LLMJudge Scorer │  │ EventCollector   │
│ - Wraps at runtime│     │ - 6 dimensions   │  │ - Span hierarchy │
│ - Tracks metrics │      │ - Full context   │  │ - Error aggregation│
└──────────────────┘      └──────────────────┘  └──────────────────┘
         │                           │             │
         └───────────────┬───────────┘             │
                         ▼                         ▼
┌─────────────────────────────────────────────────────────────┐
│                    Braintrust API                           │
│  - Online telemetry (initLogger)                            │
│  - Experiment tracking (when experimentId provided)         │
│  - BTQL queries for replay                                  │
└─────────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                  ExperimentRunner                           │
│  - Fetches historical logs by tag                           │
│  - Replays tasks in v2 code                                │
│  - Compares v1 baseline vs v2 performance                  │
└─────────────────────────────────────────────────────────────┘
```

### Purpose and Goals

1. **Real-time Telemetry**: Track every agent execution with detailed metrics
2. **Quality Scoring**: Multi-dimensional LLM-based scoring of task completion quality
3. **A/B Testing**: Compare code changes against baseline performance
4. **Error Tracking**: Aggregate and monitor tool failures and errors
5. **Performance Analysis**: Identify bottlenecks and optimization opportunities

### Key Components

- **BraintrustEventCollector**: Singleton telemetry collector with lazy initialization
- **Tool Telemetry System**: Dynamic runtime wrapping of tools for tracking
- **LLMJudge**: Multi-dimensional quality scoring using GPT-4
- **ExperimentRunner**: Replay and comparison system for A/B testing
- **UI Integration**: Beaker button in side panel for running experiments

## 2. Component Deep Dive

### BraintrustEventCollector (`src/evals/BraintrustEventCollector.ts`)

The central telemetry component that manages event collection and session tracking.

#### Singleton Implementation
```typescript
export class BraintrustEventCollector {
  private static instance: BraintrustEventCollector | null = null
  private enabled: boolean = false
  private logger: any = null
  private initialized: boolean = false
  
  // Singleton pattern
  static getInstance(): BraintrustEventCollector {
    if (!BraintrustEventCollector.instance) {
      BraintrustEventCollector.instance = new BraintrustEventCollector()
    }
    return BraintrustEventCollector.instance
  }
}
```

#### Session and Task Management
- **Session**: Parent span for entire conversation (multiple tasks)
- **Task**: Child span for individual user requests
- **Lazy Initialization**: Only initializes when first task starts

```typescript
async startSession(metadata: SessionMetadata): Promise<{ parent?: string }> {
  // Creates root span for conversation
  const parent = await this.logger.traced(async (span: any) => {
    span.log({
      input: validatedMetadata.task,
      metadata: {
        sessionId: validatedMetadata.sessionId,
        timestamp: validatedMetadata.timestamp,
        tabContext: validatedMetadata.tabContext,
        type: 'session_start',
        conversation: true
      }
    })
    return await span.export()  // Returns parent span ID
  }, { name: 'agent_session' })
  
  return { parent }
}
```

#### Span Hierarchy Structure
```
agent_session (root)
├── task_1_start
├── classification_tool
├── planner_tool
├── navigation_tool
├── task_1_success (with scores)
├── task_2_start
├── ...
└── session_end (with aggregate scores)
```

#### Error Aggregation Logic
```typescript
// Track tool errors per session
private toolErrorCounts: Map<string, number> = new Map()

// In logEvent() for tool_execution events
if (event.type === 'tool_execution' && event.data?.success === false) {
  const toolName = event.data.toolName || 'unknown'
  const errorCount = (this.toolErrorCounts.get(toolName) || 0) + 1
  this.toolErrorCounts.set(toolName, errorCount)
}

// In endSession() - aggregate errors
const totalToolErrors = Array.from(this.toolErrorCounts.values())
  .reduce((sum, count) => sum + count, 0)
```

### Tool Telemetry System (`src/evals/tool-wrapper.ts`)

Dynamic tool wrapping that adds telemetry without modifying tool implementations.

#### How createTrackedTool Works
```typescript
export function createTrackedTool(
  tool: DynamicStructuredTool, 
  context: ExecutionContext
): DynamicStructuredTool {
  const wrapTraced = telemetry.getWrapTraced()
  
  // wrapTraced creates spans automatically
  const trackedFunc = wrapTraced(
    async (input: any, span: any) => {
      const startTime = performance.now()
      
      try {
        const result = await originalFunc(input)
        const duration = performance.now() - startTime
        
        // Check for soft errors (tool returned ok: false)
        const parsedResult = JSON.parse(result)
        const isError = !parsedResult.ok
        
        // Log metrics to Braintrust
        span.log({
          metrics: {
            duration_ms: duration,
            success: !isError ? 1 : 0
          },
          metadata: {
            tool_name: toolName,
            messageIndex: context.messageManager.getMessages().length
          }
        })
        
        return result
      } catch (error) {
        // Handle hard errors (exceptions)
        span.log({
          error: {
            name: 'Tool error',
            message: `${toolName}: ${error?.message}`,
            stack: error?.stack
          }
        })
        throw error
      }
    },
    { type: 'tool', name: toolName, parent: context.parentSpanId }
  )
  
  return new DynamicStructuredTool({
    ...tool,
    func: trackedFunc
  })
}
```

#### Dynamic Wrapping at Runtime
In `BrowserAgent.ts`:
```typescript
private async _executeToolWithTransform(toolName: string, args: any) {
  let tool = this.toolManager.getTool(toolName)
  
  // Dynamically wrap tool with telemetry if session is active
  if (this.executionContext.telemetry?.isEnabled() && 
      this.executionContext.parentSpanId) {
    const wrappedTool = createTrackedTool(tool, this.executionContext)
    toolFunc = wrappedTool.func
  }
  
  const toolResult = await toolFunc(args)
}
```

#### Metrics Tracked
- **duration_ms**: Execution time in milliseconds
- **success**: Binary (0/1) success indicator
- **tool_error_count**: Running count of errors for this tool
- **messageIndex**: Position in conversation
- **error_kind**: 'logical' (soft) vs 'runtime' (hard)

#### Error Handling
1. **Soft Errors**: Tool returns `{ok: false, error: "message"}`
   - Tracked but execution continues
   - Logged as 'logical_error'
   
2. **Hard Errors**: Tool throws exception
   - Tracked and re-thrown
   - Logged as 'runtime_exception'

### LLMJudge Scoring System (`src/evals/scoring/LLMJudge.ts`)

Multi-dimensional quality scoring using LLM-as-judge pattern.

#### 6-Dimensional Scoring Breakdown
```typescript
const HOLISTIC_SCORE_WEIGHTS = {
  goal_achievement: 0.40,      // 40% - Did we achieve the goal?
  execution_quality: 0.20,     // 20% - How well was it executed?
  execution_precision: 0.15,   // 15% - Precise without retries?
  progress_made: 0.10,         // 10% - How much progress made?
  plan_coherence: 0.08,        // 8% - Was the plan logical?
  error_handling: 0.07         // 7% - How were errors handled?
}
```

#### Score Calculation
```typescript
function calculateWeightedAverage(scores: Record<string, number>): number {
  let weightedSum = 0
  let totalWeight = 0
  
  for (const [dimension, weight] of Object.entries(HOLISTIC_SCORE_WEIGHTS)) {
    if (dimension in scores && scores[dimension] >= 0) {
      weightedSum += scores[dimension] * weight
      totalWeight += weight
    }
  }
  
  return totalWeight > 0 ? weightedSum / totalWeight : FALLBACK_SCORE
}
```

#### Context Extraction
```typescript
private async buildFullContext(context: ExecutionContext) {
  // Direct access to stores - no copying
  const messages = context.messageManager.getMessages()
  const todos = context.todoStore.getAll()
  const currentDoing = context.todoStore.getCurrentDoing()
  
  // Extract tool executions from messages
  const toolExecutions = extractToolExecutions(messages)
  
  // Count tool retries
  const toolRetries = countRetries(toolExecutions)
  
  return {
    eventData: { task, success, duration_ms, phase },
    currentPlan: todos,
    recentMessages: messages.slice(-5),
    pageUrl, pageTitle,
    toolExecutions,
    browserStates,
    toolRetries,
    totalToolCalls,
    failedToolCalls,
    uniqueToolsUsed,
    fullConversation: messages,  // Direct reference
    allTodos: todos,             // Direct reference
    tokenCount
  }
}
```

#### Integration Points
Called in `NxtScape._finalizeTask()`:
```typescript
private async _finalizeTask(outcome: string, query: string) {
  const judge = new LLMJudge()
  const result = await judge.scoreTaskCompletionWithContext(
    query,
    this.executionContext,
    { outcome, duration_ms }
  )
  
  // Log scores to telemetry
  await this.telemetry.logEvent({
    type: 'decision_point',
    name: `task_${taskCount}_${outcome}`,
    scores: result.scores,
    scoring_details: result.scoringDetails
  })
}
```

### ExperimentRunner (`src/evals/ExperimentRunner.ts`)

Manages A/B testing by replaying historical tasks.

#### Replay Mechanism
1. **Fetch Historical Logs**: Query Braintrust for tagged logs
2. **Create Experiments**: v1 (baseline) and v2 (new code)
3. **Replay Each Task**: Run v2 code on v1 inputs
4. **Compare Results**: Side-by-side comparison in Braintrust

```typescript
static async runSingleTest(log: any, index: number, 
                           v1ExperimentId: string, v2ExperimentId: string) {
  // Cleanup before test
  await this.performCompleteCleanup()
  
  // Run v2 code with experiment ID for dual logging
  const experimentNxtScape = new NxtScape({ 
    experimentId: v2ExperimentId  // Enables dual logging
  })
  
  await experimentNxtScape.run({
    query: log.input,  // v1 input
    mode: 'browse'
  })
  
  // NxtScape already scored with LLMJudge
  // Results logged to both telemetry AND experiment
}
```

#### V1 vs V2 Comparison
- **V1 (Baseline)**: Historical execution with original scores
- **V2 (New Code)**: Fresh execution with new scores
- **Comparison**: Braintrust UI shows side-by-side diff

#### BTQL Queries
```typescript
// Fetch logs by tag
static buildLogQuery(tag: string, maxLogs: number) {
  return {
    query: `select: *
from: project_logs('${BRAINTRUST_PROJECT_UUID}')
filter:
  is_root
  and tags INCLUDES '${tag}'
sort: created desc
limit: ${maxLogs}`,
    fmt: "json"
  }
}

// Fetch child spans for scores
static buildChildSpanQuery(spanId: string) {
  return {
    query: `select: *
from: project_logs('${BRAINTRUST_PROJECT_UUID}')
filter:
  root_span_id = '${spanId}'
  and not is_root
sort: created asc`,
    fmt: "json"
  }
}
```

#### Cleanup and Isolation
```typescript
private static async performCompleteCleanup(): Promise<void> {
  // 1. Clear Chrome storage
  await chrome.storage.local.clear()
  await chrome.storage.session.clear()
  
  // 2. Reset singletons
  const telemetry = BraintrustEventCollector.getInstance()
  telemetry.toolErrorCounts.clear()
  telemetry.executionContext = null
  telemetry.initialized = false
  
  // 3. Close all tabs and create fresh one
  const newTab = await chrome.tabs.create({ active: false })
  const allTabs = await chrome.tabs.query({})
  const tabsToClose = allTabs.filter(tab => tab.id !== newTab.id)
  await Promise.all(tabsToClose.map(tab => chrome.tabs.remove(tab.id)))
  
  // 4. Stabilization delay
  await new Promise(resolve => setTimeout(resolve, 300))
}
```

#### UI Integration - Beaker Button
In `ExperimentModal.tsx`:
```typescript
export function ExperimentModal({ sendMessage }) {
  const handleRunExperiment = () => {
    sendMessage(MessageType.RUN_EXPERIMENT, {
      logsTag: experimentConfig.logsTag  // e.g., "v1"
    })
  }
  
  // Background script handles the actual experiment
  // Shows progress updates in UI
}
```

## 3. Data Flow Diagrams

### User Interaction → Telemetry → Braintrust
```
User Query
    ↓
NxtScape.run()
    ↓
_initializeTelemetrySession() [lazy, once per conversation]
    ↓
startSession() → Braintrust parent span
    ↓
BrowserAgent.execute()
    ↓
For each tool:
  createTrackedTool() → wrapTraced() → Braintrust child span
    ↓
_finalizeTask() 
    ↓
LLMJudge.scoreTaskCompletionWithContext()
    ↓
logEvent() with scores → Braintrust
    ↓
endSession() with aggregates → Braintrust
```

### Experiment Flow: Tag → Replay → Compare
```
1. Tag logs in production: 
   User sessions tagged with "v1"
   
2. Start experiment:
   Beaker button → fetchAvailableTags() → select "v1"
   
3. Create experiments:
   v1(baseline)--timestamp
   v1(new)--timestamp with base_exp_id
   
4. Replay each log:
   fetchAndValidateLogs("v1") → logs[]
   For each log:
     runSingleTest() with cleanup
     NxtScape with experimentId (dual logging)
     
5. Compare in Braintrust UI:
   Side-by-side diff of v1 vs v2 scores
```

### Tool Execution → Wrapping → Logging
```
BrowserAgent._executeToolWithTransform(toolName, args)
    ↓
if (telemetry.isEnabled() && parentSpanId):
    createTrackedTool(tool, context)
        ↓
    wrapTraced(func, {parent: spanId})
        ↓
    Execute original tool.func(args)
        ↓
    Measure duration, check result
        ↓
    span.log({metrics, metadata, error?})
        ↓
    Return result (or throw)
```

### Scoring Pipeline
```
Task completion/error/pause
    ↓
NxtScape._finalizeTask()
    ↓
LLMJudge.buildFullContext(executionContext)
    ↓
Extract from stores:
  - MessageManager: full conversation
  - TodoStore: plan and progress
  - BrowserContext: current state
  - Tool executions and retries
    ↓
Generate scoring prompt (5-10k tokens)
    ↓
OpenAI GPT-4 with JSON response format
    ↓
Parse 6 dimension scores
    ↓
Calculate weighted average
    ↓
Log to Braintrust with scores & details
```

## 4. Configuration

### Environment Variables
In `.env` file:
```bash
# Enable telemetry collection
ENABLE_TELEMETRY=true

# Braintrust API key for logging
BRAINTRUST_API_KEY=sk-xxx

# OpenAI key for LLM scoring (optional)
OPENAI_API_KEY_FOR_SCORING=sk-xxx

# Scoring model (defaults to gpt-4o)
OPENAI_MODEL_FOR_SCORING=gpt-4o

# Project UUID from Braintrust dashboard (for experiments)
BRAINTRUST_PROJECT_UUID=xxx-xxx-xxx
```

### Braintrust Project Setup
1. Create project "browseros-agent-online" in Braintrust
2. Copy project UUID from settings
3. API key needs write permissions

### Feature Toggles
```typescript
// config.ts
export const ENABLE_TELEMETRY = process.env.ENABLE_TELEMETRY === 'true'

// Runtime check in code
if (telemetry?.isEnabled()) {
  // Telemetry code
}
```

### Chrome Extension Integration
- Background script imports config
- Service worker handles experiment execution
- Message passing between UI and background

## 5. API Integration

### Braintrust API Endpoints

#### Logging Events
```typescript
POST https://api.braintrust.dev/v1/insert
{
  experiment: {
    [experimentId]: {
      events: [{
        id: string,
        input: any,
        output: any,
        expected?: any,
        scores: Record<string, number>,  // 0-1 values only
        metadata: any,
        span_id: string,
        parent_span_id: string
      }]
    }
  }
}
```

#### BTQL Queries
```typescript
POST https://api.braintrust.dev/btql
{
  query: "BTQL query string",
  fmt: "json"
}
```

#### Create Experiment
```typescript
POST https://api.braintrust.dev/v1/experiment
{
  name: string,
  project_id: string,  // UUID
  base_exp_id?: string,  // For comparison
  ensure_new: true
}
```

### Payload Structures

#### Session Start
```typescript
{
  input: "user task",
  metadata: {
    sessionId: "uuid",
    timestamp: 1234567890,
    tabContext: {...},
    type: 'session_start',
    conversation: true
  }
}
```

#### Tool Execution
```typescript
{
  metrics: {
    duration_ms: 123,
    success: 1
  },
  metadata: {
    tool_name: "navigation_tool",
    messageIndex: 5
  },
  error?: {  // If failed
    name: "Tool error",
    message: "Details",
    stack?: "..."
  }
}
```

#### Task Completion with Scores
```typescript
{
  type: 'decision_point',
  name: 'task_1_success',
  scores: {
    goal_achievement: 0.8,
    execution_quality: 0.7,
    execution_precision: 0.9,
    progress_made: 1.0,
    plan_coherence: 0.6,
    error_handling: 0.8,
    weighted_total: 0.79
  },
  scoring_details: {
    model: "gpt-4o",
    contextSummary: {...}
  }
}
```

### Authentication
```typescript
headers: {
  'Authorization': `Bearer ${BRAINTRUST_API_KEY}`,
  'Content-Type': 'application/json'
}
```

### Error Handling
- API errors return JSON with `error` field
- Network errors throw exceptions
- Telemetry failures are silent (don't break agent)

## 6. Current Implementation Issues

### Performance Bottlenecks

1. **LLM Scoring Latency**: GPT-4 scoring adds 2-3 seconds per task
   - Currently synchronous, blocks task completion
   - Could be made async/fire-and-forget

2. **Memory Leaks in Singletons**: Long-running sessions accumulate state
   - Tool error counts never cleared between conversations
   - Message history grows unbounded

3. **Experiment Replay Speed**: Serial execution of tests
   - Each test waits for full cleanup (300ms+)
   - Could parallelize with multiple browser contexts

### Complexity Issues

1. **Tight Coupling**: Components deeply integrated
   - NxtScape directly imports and uses BraintrustEventCollector
   - BrowserAgent knows about telemetry details
   - Hard to test in isolation

2. **Dual Logging Confusion**: Experiments use both telemetry AND experiment logging
   - Same data logged twice to different endpoints
   - Scores calculated multiple times

3. **Span Hierarchy Complexity**: Parent/child relationships hard to track
   - Manual span ID passing through context
   - Easy to break trace continuity

### Inconsistent Data Formats

1. **Score Field Names**: Multiple conventions
   - `success` vs `task_completion` vs `task_completed`
   - `weighted_total` vs `avg_weighted_total` vs `holistic_score`

2. **Error Representations**: Three different formats
   - String in `data.error`
   - Object in top-level `error` field
   - Exception in `metadata.error`

3. **Timestamp Formats**: Mix of representations
   - Epoch milliseconds (Date.now())
   - ISO strings (toISOString())
   - No timezone consistency

## 7. Recommended Improvements

### Architectural Changes

1. **Decouple Telemetry from Core**
   ```typescript
   // Use dependency injection instead of singleton
   class NxtScape {
     constructor(private telemetry?: TelemetryProvider) {}
   }
   
   // Abstract interface
   interface TelemetryProvider {
     startSession(metadata: any): Promise<string>
     logEvent(event: any): Promise<void>
     endSession(result: any): Promise<void>
   }
   ```

2. **Async Scoring Pipeline**
   ```typescript
   // Fire and forget scoring
   _finalizeTask(outcome) {
     // Log completion immediately
     this.telemetry.logEvent({type: 'task_complete'})
     
     // Score async without blocking
     this.scoreAsync(outcome).catch(console.error)
   }
   ```

3. **Event Bus Pattern**
   ```typescript
   // Centralized event bus
   EventBus.on('tool.executed', (data) => {
     telemetry.logToolExecution(data)
   })
   
   // Tools just emit events
   tool.execute = () => {
     const result = originalExecute()
     EventBus.emit('tool.executed', {tool, result})
     return result
   }
   ```

### Specific Refactoring

1. **Standardize Score Schema**
   ```typescript
   const ScoreSchema = z.object({
     // Dimensions (0-1)
     goal_achievement: z.number().min(0).max(1),
     execution_quality: z.number().min(0).max(1),
     execution_precision: z.number().min(0).max(1),
     progress_made: z.number().min(0).max(1),
     plan_coherence: z.number().min(0).max(1),
     error_handling: z.number().min(0).max(1),
     // Aggregates
     weighted_total: z.number().min(0).max(1),
     // Metadata
     scorer_version: z.string(),
     timestamp: z.string()  // ISO format
   })
   ```

2. **Unified Error Type**
   ```typescript
   const ErrorEventSchema = z.object({
     type: z.literal('error'),
     error: z.object({
       code: z.string(),  // error_type
       message: z.string(),
       details: z.any().optional(),
       stack: z.string().optional()
     }),
     context: z.object({
       tool?: z.string(),
       phase?: z.string(),
       timestamp: z.string()
     })
   })
   ```

3. **Simplified Tool Wrapping**
   ```typescript
   // Decorator pattern
   @traced
   class NavigationTool {
     @trackExecution
     async execute(args) {
       // Automatic tracking via decorator
     }
   }
   ```

### Performance Optimizations

1. **Batch Event Logging**
   ```typescript
   class BatchedTelemetry {
     private queue: Event[] = []
     private timer: NodeJS.Timeout
     
     logEvent(event) {
       this.queue.push(event)
       this.scheduleBatch()
     }
     
     private async flush() {
       if (this.queue.length > 0) {
         await this.logger.logBatch(this.queue)
         this.queue = []
       }
     }
   }
   ```

2. **Lazy Context Building**
   ```typescript
   // Only build what's needed
   buildContext(requirements: string[]) {
     const context = {}
     if (requirements.includes('messages')) {
       context.messages = this.getMessages()
     }
     if (requirements.includes('tools')) {
       context.tools = this.getToolHistory()
     }
     return context
   }
   ```

3. **Parallel Experiment Execution**
   ```typescript
   // Run tests in parallel with isolation
   async runExperiments(logs: Log[]) {
     const workers = Array(3).fill(null).map(() => 
       new ExperimentWorker()
     )
     
     const results = await Promise.all(
       logs.map((log, i) => 
         workers[i % 3].runTest(log)
       )
     )
   }
   ```

### Better Separation of Concerns

1. **Telemetry Module Structure**
   ```
   src/telemetry/
   ├── core/
   │   ├── TelemetryProvider.ts      # Abstract interface
   │   ├── EventSchema.ts            # Zod schemas
   │   └── EventBus.ts              # Central events
   ├── providers/
   │   ├── BraintrustProvider.ts    # Braintrust impl
   │   ├── ConsoleProvider.ts       # Debug logging
   │   └── NoopProvider.ts          # Disabled state
   ├── scoring/
   │   ├── ScoringPipeline.ts       # Async scoring
   │   ├── LLMScorer.ts            # GPT-4 scorer
   │   └── RuleScorer.ts           # Heuristic scorer
   └── experiments/
       ├── ExperimentRunner.ts      # A/B testing
       ├── ReplayEngine.ts         # Task replay
       └── Comparator.ts           # Result comparison
   ```

2. **Clear Interfaces**
   ```typescript
   // Tool doesn't know about telemetry
   interface Tool {
     execute(args: any): Promise<Result>
   }
   
   // Telemetry wraps via middleware
   interface Middleware {
     wrap(tool: Tool): Tool
   }
   
   // Clean composition
   const trackedTool = telemetryMiddleware.wrap(tool)
   ```

## 8. Code Examples

### How to Add Telemetry to a New Tool

```typescript
// 1. Tool implementation (no telemetry code)
export function createMyTool(): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: 'my_tool',
    description: 'Does something',
    schema: z.object({
      param: z.string()
    }),
    func: async (args) => {
      // Tool logic here
      const result = await doSomething(args.param)
      return JSON.stringify({
        ok: true,
        output: result
      })
    }
  })
}

// 2. Tool gets wrapped automatically in BrowserAgent
// No changes needed - dynamic wrapping handles it!
```

### How to Run an Experiment

```typescript
// 1. Tag production logs
// Logs are automatically tagged based on git branch or manual tags

// 2. Run experiment from UI
// Click beaker button → Select tag → Start

// 3. Or programmatically:
import { ExperimentHelper } from '@/evals/ExperimentRunner'

async function runExperiment() {
  // Fetch available tags
  const tags = await ExperimentHelper.fetchAvailableTags(apiKey)
  
  // Select tag (e.g., "v1")
  const logsTag = tags[0].tag
  
  // Fetch logs
  const logs = await ExperimentHelper.fetchAndValidateLogs(
    logsTag, 20, apiKey
  )
  
  // Create experiments
  const experiments = await ExperimentHelper.createExperiments(
    logsTag, apiKey
  )
  
  // Run each test
  for (const [index, log] of logs.entries()) {
    const result = await ExperimentHelper.runSingleTest(
      log, index,
      experiments.v1ExperimentId,
      experiments.v2ExperimentId,
      apiKey
    )
    console.log(`Test ${index + 1}: ${result.success}`)
  }
  
  // View comparison
  console.log(`Compare at: ${experiments.urls.compareUrl}`)
}
```

### How to Add a New Scoring Dimension

```typescript
// 1. Update score weights
const HOLISTIC_SCORE_WEIGHTS = {
  goal_achievement: 0.35,      // Reduced from 0.40
  execution_quality: 0.20,
  execution_precision: 0.15,
  progress_made: 0.10,
  plan_coherence: 0.08,
  error_handling: 0.07,
  user_experience: 0.05        // NEW dimension
}

// 2. Update scoring prompt
export function getMultiDimensionalScoringPrompt(task, context) {
  return `
  ...existing prompt...
  
  7. User Experience (0.0 to 1.0):
  - Was the execution smooth from user perspective?
  - Were there unnecessary delays or retries?
  - Score 1.0 if seamless, 0.0 if very frustrating
  `
}

// 3. Update type definitions
export type MultiDimensionalScores = {
  ...existing,
  user_experience: number
}

// 4. Scores automatically flow through system
```

### How to Debug Telemetry Issues

```typescript
// 1. Enable debug logging in browser console
window.__BROWSEROS_TELEMETRY_ENABLED  // Check if enabled

// 2. View telemetry events in console
// Look for colored console logs:
// → Telemetry: Starting session (gray)
// → Tool: navigation_tool (123ms) (gray)
// ✗ Tool: navigation_tool failed (red)

// 3. Check Braintrust dashboard
// https://braintrust.dev/app/Felafax/p/browseros-agent-online/logs
// Filter by session_id or tags

// 4. Inspect span hierarchy
// In Braintrust, click on a log entry
// View "Trace" tab to see parent/child relationships

// 5. Debug scoring
// LLMJudge logs context summary (collapsed by default)
console.groupCollapsed('📋 LLM Scorer Context Summary')
// Expand to see full scoring prompt and context

// 6. Force flush telemetry
const telemetry = BraintrustEventCollector.getInstance()
await telemetry.flush()

// 7. Reset telemetry state (for testing)
telemetry.toolErrorCounts.clear()
telemetry.initialized = false
telemetry.enabled = false
```

## Summary

The current evaluation system provides comprehensive telemetry and experimentation capabilities but suffers from tight coupling and complexity issues. The architecture successfully tracks detailed execution metrics and enables A/B testing through replay, but would benefit from:

1. **Decoupling** telemetry from core components via dependency injection
2. **Standardizing** data formats and schemas across the system  
3. **Optimizing** performance through async operations and batching
4. **Simplifying** the tool wrapping and span hierarchy management
5. **Improving** error handling and recovery mechanisms

The system demonstrates sophisticated capabilities for production monitoring and controlled experimentation, making it valuable for continuous improvement of the agent's performance. With the recommended architectural improvements, it could become more maintainable, testable, and performant while preserving its powerful evaluation capabilities.