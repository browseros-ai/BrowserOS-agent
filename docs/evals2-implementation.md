# Evals2 Implementation Documentation

## Overview

Evals2 is a simplified evaluation framework for the Nxtscape browser automation system. It represents a complete rewrite of the original evaluation system, achieving a 75% reduction in code complexity (500 lines vs 2000+) while maintaining full functionality.

## Architecture

### Core Components

The evals2 system consists of four main components:

```
┌─────────────────────────────────────────────────────┐
│                    NxtScape                         │
│  (Session Lifecycle & Scoring Trigger)              │
└────────────────────┬────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────┐
│                 BrowserAgent                        │
│  (Tool Wrapping & Metrics Collection)               │
└────────────────────┬────────────────────────────────┘
                     │
        ┌────────────┴────────────┬─────────────┐
        ▼                         ▼             ▼
┌───────────────┐  ┌──────────────────┐  ┌──────────────┐
│SimpleToolWrapper│  │SimplifiedScorer  │  │SimpleBraintrust│
│               │  │                  │  │EventManager   │
│ Duration      │  │ 4-Dimension      │  │              │
│ Tracking      │  │ Scoring Engine   │  │ Session Mgmt │
└───────────────┘  └──────────────────┘  └──────────────┘
                            │
                   ┌────────▼─────────┐
                   │SimpleBraintrust  │
                   │Logger           │
                   │                 │
                   │ Score Reporting │
                   └─────────────────┘
```

### Component Details

#### 1. SimpleToolWrapper (`src/evals2/SimpleToolWrapper.ts`)
- **Purpose**: Lightweight tool duration tracking
- **Implementation**: Uses Map-based storage in ExecutionContext.toolMetrics
- **Performance**: ~1ms overhead per tool call
- **Key Methods**:
  - `wrapTool()`: Wraps a tool with start/end timing logic
  - Stores metrics as `{toolName, startTime, endTime}` in Map

#### 2. SimplifiedScorer (`src/evals2/SimplifiedScorer.ts`)
- **Purpose**: Multi-dimensional scoring of agent performance
- **Scoring Dimensions**:
  - Goal Completion (40%): Task achievement assessment
  - Plan Correctness (30%): Execution efficiency evaluation
  - Error-Free Execution (15%): Error handling quality
  - Context Efficiency (15%): Token usage optimization
- **Features**:
  - LLM-based scoring with GPT-4o-mini (when available)
  - Heuristic fallback for offline/no-API scenarios
  - Returns structured scores with explanations

#### 3. SimpleBraintrustEventManager (`src/evals2/SimpleBraintrustEventManager.ts`)
- **Purpose**: Session lifecycle management
- **Key Features**:
  - Parent span creation for conversation sessions
  - Lazy loading of Braintrust SDK
  - Graceful handling of missing API keys
  - Session ID tracking

#### 4. SimpleBraintrustLogger (`src/evals2/SimpleBraintrustLogger.ts`)
- **Purpose**: Score reporting to Braintrust platform
- **Implementation**:
  - Uploads scores as child spans
  - Includes metadata (model, prompts, metrics)
  - Handles connection failures gracefully

## Execution Flow

### 1. Session Initialization
```typescript
// In NxtScape.run()
if (process.env.ENABLE_EVALS2 === 'true') {
  await SimpleBraintrustEventManager.startConversationSession({
    sessionId: executionContext.sessionId,
    userId: 'user',
    initialMessage: userMessage
  });
}
```

### 2. Tool Wrapping
```typescript
// In BrowserAgent.bindToolsToLLM()
if (process.env.ENABLE_EVALS2 === 'true') {
  const wrappedTools = tools.map(tool => 
    SimpleToolWrapper.wrapTool(tool, this.executionContext)
  );
}
```

### 3. Metrics Collection
During execution, tool durations are automatically collected:
```typescript
// Stored in ExecutionContext.toolMetrics Map
Map<string, {
  toolName: string;
  startTime: number;
  endTime: number;
}>
```

### 4. Scoring After Task
```typescript
// In NxtScape.run() after agent.execute()
const scores = await SimplifiedScorer.scoreMessages({
  messages: executionContext.messageManager.messages,
  toolMetrics: executionContext.toolMetrics,
  userMessage: userMessage,
  finalResponse: result
});
```

### 5. Score Reporting
```typescript
await SimpleBraintrustLogger.logScores({
  scores,
  metadata: {
    model: llmSettings.model,
    provider: llmSettings.provider,
    sessionId: executionContext.sessionId
  },
  parentSpan: SimpleBraintrustEventManager.getParentSpan()
});
```

## Scoring Methodology

### Four-Dimension Scoring System

1. **Goal Completion (40% weight)**
   - Evaluates if the agent achieved the user's requested task
   - Scored 0-10 based on completion level
   - Considers partial completions and alternative solutions

2. **Plan Correctness (30% weight)**
   - Assesses the efficiency of the execution plan
   - Evaluates tool selection and sequencing
   - Penalizes unnecessary steps or redundant actions

3. **Error-Free Execution (15% weight)**
   - Tracks error handling and recovery
   - Scores based on error frequency and severity
   - Rewards graceful degradation

4. **Context Efficiency (15% weight)**
   - Measures token usage optimization
   - Evaluates message conciseness
   - Rewards efficient context management

### Scoring Implementation

```typescript
// LLM-based scoring (preferred)
if (process.env.OPENAI_MODEL_FOR_SCORING) {
  const llmScore = await this.scoreWithLLM(messages, userMessage);
  return llmScore;
}

// Heuristic fallback
return this.scoreWithHeuristics(messages, toolMetrics);
```

## Configuration

### Environment Variables

```bash
# Enable evals2 system
ENABLE_EVALS2=true

# Braintrust API key for reporting
BRAINTRUST_API_KEY=your-braintrust-api-key

# Optional: OpenAI model for scoring
OPENAI_MODEL_FOR_SCORING=gpt-4o-mini

# Optional: OpenAI API key (if different from main)
OPENAI_API_KEY=your-openai-api-key
```

### Integration Points

The system requires minimal integration with only two hooks:

1. **NxtScape** (`src/lib/core/NxtScape.ts`):
   - Session start/end lifecycle
   - Scoring trigger after task completion

2. **BrowserAgent** (`src/lib/agent/BrowserAgent.ts`):
   - Tool wrapping for metrics collection

## Key Improvements from V1

### Code Simplification
- **75% reduction** in codebase size (500 lines vs 2000+)
- Removed complex span tree management
- Simplified to Map-based tracking

### Performance
- **~1ms overhead** per tool call (vs 10-20ms in v1)
- Map lookups instead of span traversal
- Lazy loading of dependencies

### Reliability
- **Graceful degradation** when APIs unavailable
- Works offline with heuristic scoring
- No blocking operations

### Maintainability
- Clear separation of concerns
- Testable components
- Minimal coupling with main codebase

## Usage Examples

### Basic Usage
```typescript
// Automatic - just set environment variable
process.env.ENABLE_EVALS2 = 'true';

// The system will automatically:
// 1. Track all tool executions
// 2. Score after each task
// 3. Report to Braintrust (if configured)
```

### Programmatic Access
```typescript
// Access scores directly
const scores = await SimplifiedScorer.scoreMessages({
  messages: messageHistory,
  toolMetrics: toolMetricsMap,
  userMessage: "Book a flight to Paris",
  finalResponse: agentResponse
});

console.log(`Goal Completion: ${scores.goalCompletion}/10`);
console.log(`Overall Score: ${scores.overallScore}/10`);
```

### Custom Tool Wrapping
```typescript
// Wrap a custom tool
const wrappedTool = SimpleToolWrapper.wrapTool(
  myCustomTool,
  executionContext
);

// Metrics automatically collected in executionContext.toolMetrics
```

## Testing

### Unit Tests
```bash
# Run evals2 specific tests
npm test -- src/evals2/

# Test individual components
npm test -- SimplifiedScorer.test.ts
```

### Integration Testing
```bash
# Enable evals2 and run full integration
ENABLE_EVALS2=true npm test -- integration/
```

## Monitoring & Debugging

### Debug Output
```typescript
// Enable debug logging
process.env.DEBUG_EVALS2 = 'true';

// Logs will show:
// - Tool wrapping events
// - Scoring calculations
// - Braintrust upload status
```

### Metrics Access
```typescript
// Access raw metrics during execution
const metrics = executionContext.toolMetrics;
metrics.forEach((metric, id) => {
  console.log(`Tool: ${metric.toolName}`);
  console.log(`Duration: ${metric.endTime - metric.startTime}ms`);
});
```

## Future Improvements

### Planned Enhancements
1. **Real-time scoring** - Score during execution, not just after
2. **Custom scoring dimensions** - Allow user-defined scoring criteria
3. **Batch uploading** - Aggregate scores before uploading
4. **Local storage** - Cache scores locally for offline analysis

### Open Questions
1. Should scoring be synchronous or async with the main flow?
2. How to handle multi-turn conversations vs single tasks?
3. Should we support custom scoring providers beyond OpenAI?
4. How to visualize scores in the UI?

## Troubleshooting

### Common Issues

**Evals2 not running:**
- Check `ENABLE_EVALS2=true` is set
- Verify environment variables are loaded

**Scores not uploading:**
- Verify `BRAINTRUST_API_KEY` is valid
- Check network connectivity
- Look for error logs in console

**LLM scoring failing:**
- Verify `OPENAI_MODEL_FOR_SCORING` is set
- Check OpenAI API key and quota
- System falls back to heuristics automatically

**High overhead:**
- Check for duplicate tool wrapping
- Verify Maps are being cleared after sessions
- Monitor memory usage

## API Reference

### SimplifiedScorer
```typescript
interface ScoreResult {
  goalCompletion: number;      // 0-10
  planCorrectness: number;      // 0-10
  errorFreeExecution: number;   // 0-10
  contextEfficiency: number;    // 0-10
  overallScore: number;         // Weighted average
  explanation?: string;         // LLM reasoning
}

class SimplifiedScorer {
  static async scoreMessages(params: {
    messages: Message[];
    toolMetrics: Map<string, ToolMetric>;
    userMessage: string;
    finalResponse: any;
  }): Promise<ScoreResult>;
}
```

### SimpleToolWrapper
```typescript
class SimpleToolWrapper {
  static wrapTool(
    tool: DynamicStructuredTool,
    executionContext: ExecutionContext
  ): DynamicStructuredTool;
}
```

### SimpleBraintrustEventManager
```typescript
class SimpleBraintrustEventManager {
  static async startConversationSession(params: {
    sessionId: string;
    userId: string;
    initialMessage: string;
  }): Promise<void>;
  
  static async endConversationSession(): Promise<void>;
  static getParentSpan(): any;
}
```

### SimpleBraintrustLogger
```typescript
class SimpleBraintrustLogger {
  static async logScores(params: {
    scores: ScoreResult;
    metadata: any;
    parentSpan?: any;
  }): Promise<void>;
}
```

## Conclusion

Evals2 represents a significant improvement in evaluation system design, prioritizing simplicity, performance, and reliability. The system's modular architecture and minimal integration requirements make it easy to maintain and extend while providing comprehensive evaluation capabilities for the Nxtscape browser automation system.