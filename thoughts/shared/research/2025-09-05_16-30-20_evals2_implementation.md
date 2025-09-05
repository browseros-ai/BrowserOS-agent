---
date: 2025-09-05T16:30:20Z
researcher: Claude
git_commit: 763beb159d1cd3f1d476f0112460ad5a8721af84
branch: dev/evals2
repository: BrowserOS-agent
topic: "Evals2 System Implementation Research"
tags: [research, codebase, evals2, evaluation, scoring, braintrust, telemetry]
status: complete
last_updated: 2025-09-05
last_updated_by: Claude
---

# Research: Evals2 System Implementation

**Date**: 2025-09-05T16:30:20Z
**Researcher**: Claude
**Git Commit**: 763beb159d1cd3f1d476f0112460ad5a8721af84
**Branch**: dev/evals2
**Repository**: BrowserOS-agent

## Research Question
Understanding how the evals2 system is implemented, including its architecture, evaluation flow, scoring mechanisms, and integration points with the main codebase.

## Summary

Evals2 is a simplified evaluation system that tracks agent execution metrics and scores task completion quality. It's a complete rewrite of the original evaluation system with ~75% less code complexity (500 lines vs 2000+ lines). The system focuses on lightweight tool tracking, 4-dimension scoring, session management for conversation hierarchy, and minimal integration with only 2 hooks in the existing codebase.

## Detailed Findings

### Overall Architecture and Design

The evals2 system follows a modular, lightweight architecture with clear separation of concerns:

1. **Tool Metrics Collection** ([src/evals2/SimpleToolWrapper.ts](src/evals2/SimpleToolWrapper.ts))
   - Wraps tools with duration tracking
   - Stores metrics in ExecutionContext.toolMetrics Map
   - No complex span management, just simple timing

2. **Scoring Engine** ([src/evals2/SimplifiedScorer.ts](src/evals2/SimplifiedScorer.ts))
   - Analyzes message history to extract tool calls
   - Calculates 4 dimension scores (down from 6 in v1)
   - Can use LLM for goal/plan scoring or fallback to heuristics

3. **Session Management** ([src/evals2/SimpleBraintrustEventManager.ts](src/evals2/SimpleBraintrustEventManager.ts))
   - Singleton pattern for conversation-wide tracking
   - Maintains parent span for Braintrust hierarchy
   - Tracks task scores for session averaging

4. **Result Reporting** ([src/evals2/SimpleBraintrustLogger.ts](src/evals2/SimpleBraintrustLogger.ts))
   - Simple Braintrust integration
   - Uploads scores without complex span management
   - Lazy loads Braintrust SDK to avoid module issues

### How Evaluations are Defined and Structured

Evaluations are structured around two key data types defined in [src/evals2/types.ts](src/evals2/types.ts):

1. **ToolExecution**: Tracks individual tool calls
   ```typescript
   {
     toolName: string,        // Name of the tool
     duration: number,        // Duration in milliseconds
     success: boolean,        // Whether tool succeeded
     timestamp: number,       // When tool was executed
     args?: any,              // Tool arguments
     error?: string           // Error message if failed
   }
   ```

2. **ScoreResult**: Contains evaluation scores
   ```typescript
   {
     goalCompletion: number,      // 0-1, weighted 40%
     planCorrectness: number,     // 0-1, weighted 30%
     errorFreeExecution: number,  // 0-1, weighted 15%
     contextEfficiency: number,   // 0-1, weighted 15%
     weightedTotal: number,       // Weighted average
     details: {
       toolCalls: number,
       failedCalls: number,
       retries: number,
       reasoning?: string
     }
   }
   ```

The scoring weights are configured in [src/evals2/config.ts](src/evals2/config.ts:2-7):
- Goal Completion: 40% - Most important metric
- Plan Correctness: 30% - Quality of the execution plan
- Error-Free Execution: 15% - Error handling (renamed from "errorRatio")
- Context Efficiency: 15% - Efficient use of context/tokens

### Evaluation Execution Flow

The evaluation flow follows this sequence:

1. **Session Initialization** (NxtScape._initializeTelemetrySession)
   - Checks if ENABLE_EVALS2 is true
   - Creates SimpleBraintrustEventManager singleton
   - Starts a parent session span for the conversation

2. **Tool Wrapping** (BrowserAgent tool execution)
   - Each tool is wrapped with wrapToolForMetrics ([src/lib/agent/BrowserAgent.ts:341-344](src/lib/agent/BrowserAgent.ts:341-344))
   - Metrics stored in ExecutionContext.toolMetrics Map
   - Tracks duration, success, errors per tool call

3. **Message Processing & Scoring** (NxtScape.run after task completion)
   - SimplifiedScorer.scoreFromMessages extracts tool calls from message history
   - Combines toolMetrics Map data with message parsing
   - Calculates 4 dimension scores

4. **Score Upload** (SimpleBraintrustLogger)
   - Scores uploaded to Braintrust with parent span reference
   - Session manager tracks scores for averaging

5. **Session End** (NxtScape._endTelemetrySession)
   - Calculates average score across all tasks
   - Logs session summary to Braintrust

### Key Components and Their Interactions

#### SimpleToolWrapper ([src/evals2/SimpleToolWrapper.ts](src/evals2/SimpleToolWrapper.ts))
- **Purpose**: Lightweight tool duration tracking
- **Integration Point**: BrowserAgent wraps tools before execution
- **Storage**: Uses ExecutionContext.toolMetrics Map
- **Output**: Console logs with timing (⚡ for success, ❌ for failure)

#### SimplifiedScorer ([src/evals2/SimplifiedScorer.ts](src/evals2/SimplifiedScorer.ts))
- **extractToolCalls** method ([lines 70-115](src/evals2/SimplifiedScorer.ts:70-115)):
  - Iterates through messages to find AIMessage with tool_calls
  - Matches with ToolMessage responses
  - Merges with toolMetrics Map data for accurate durations

- **Scoring Methods**:
  - **scoreGoalCompletion** ([lines 117-150](src/evals2/SimplifiedScorer.ts:117-150)): Uses LLM or checks for done_tool
  - **scorePlanCorrectness** ([lines 152-187](src/evals2/SimplifiedScorer.ts:152-187)): Evaluates tool sequence efficiency
  - **scoreErrorFreeExecution** ([lines 189-202](src/evals2/SimplifiedScorer.ts:189-202)): Success ratio minus penalties
  - **scoreContextEfficiency** ([lines 204-219](src/evals2/SimplifiedScorer.ts:204-219)): Token usage estimation

#### SimpleBraintrustEventManager ([src/evals2/SimpleBraintrustEventManager.ts](src/evals2/SimpleBraintrustEventManager.ts))
- **Singleton Pattern**: Ensures single instance across conversation
- **Session Lifecycle**:
  - startSession: Creates parent span ([lines 91-133](src/evals2/SimpleBraintrustEventManager.ts:91-133))
  - addTaskScore: Accumulates scores ([lines 138-142](src/evals2/SimpleBraintrustEventManager.ts:138-142))
  - endSession: Calculates averages and logs ([lines 147-191](src/evals2/SimpleBraintrustEventManager.ts:147-191))

#### SimpleBraintrustLogger ([src/evals2/SimpleBraintrustLogger.ts](src/evals2/SimpleBraintrustLogger.ts))
- **Lazy Initialization**: Loads Braintrust SDK only when needed
- **Simple API**: Single logTaskScore method
- **Score Upload** ([lines 45-90](src/evals2/SimpleBraintrustLogger.ts:45-90)):
  - Logs input, output, scores, and metadata
  - Uses parent span for hierarchy
  - Silent failure to avoid breaking execution

### Results Collection and Reporting

Results are collected at multiple levels:

1. **Per-Tool Metrics**:
   - Stored in ExecutionContext.toolMetrics Map
   - Console output with timing information
   - Included in scoring calculations

2. **Per-Task Scores**:
   - Calculated after each task completion in NxtScape
   - Uploaded to Braintrust as `evals2_task_score` events
   - Added to session manager for averaging

3. **Per-Session Summary**:
   - Average score across all tasks
   - Session duration and task count
   - Logged as `session_end` event in Braintrust

4. **Braintrust Dashboard**:
   - Viewable at https://braintrust.dev/app/Felafax/p/browseros-agent-online/logs
   - Events tagged with `evals2_task_score` and `agent_session`

### Configuration and Setup Requirements

The system requires minimal configuration:

1. **Environment Variables** ([src/evals2/config.ts:13-17](src/evals2/config.ts:13-17)):
   - `ENABLE_EVALS2=true` - Enables the evaluation system
   - `BRAINTRUST_API_KEY` - Required for score upload
   - `OPENAI_MODEL_FOR_SCORING` - Optional, defaults to gpt-4o-mini

2. **Integration Points** (only 2 hooks):
   - **NxtScape** ([src/lib/core/NxtScape.ts](src/lib/core/NxtScape.ts)):
     - Session initialization at conversation start
     - Scoring after each task
     - Session end on cleanup
   - **BrowserAgent** ([src/lib/agent/BrowserAgent.ts:341-344](src/lib/agent/BrowserAgent.ts)):
     - Tool wrapping for duration tracking

3. **ExecutionContext Extension** ([src/lib/runtime/ExecutionContext.ts](src/lib/runtime/ExecutionContext.ts)):
   - Added toolMetrics Map field
   - Cleared on context reset

### Differences/Improvements from Version 1

Based on the README comparison ([src/evals2/README.md:73-82](src/evals2/README.md:73-82)):

| Aspect | Old Evals (v1) | Evals2 |
|--------|----------------|---------|
| **Code Size** | ~2000 lines | ~500 lines (75% reduction) |
| **Scoring Dimensions** | 6 complex | 4 simple |
| **Tool Tracking** | Braintrust wrapTraced | Map-based duration |
| **Session Management** | Complex telemetry | Simple parent span |
| **Dependencies** | Multiple heavy deps | Minimal, lazy-loaded |
| **Integration Complexity** | Many hooks throughout | 2 hooks total |
| **Performance Overhead** | Higher with spans | ~1ms per tool call |

Key improvements:
1. **Simplicity**: Drastically reduced complexity while maintaining functionality
2. **Performance**: Lightweight Map-based tracking vs heavy span management
3. **Maintainability**: Clear separation of concerns, modular design
4. **Flexibility**: Can work with or without LLM for scoring
5. **Minimal Disruption**: Only 2 integration points in existing code

## Architecture Insights

1. **Singleton Pattern for Session Management**: Ensures consistent session tracking across the entire conversation lifecycle without passing managers through multiple layers.

2. **Map-Based Tool Metrics**: Using ExecutionContext.toolMetrics Map provides O(1) lookup performance and avoids the complexity of span-based tracking.

3. **Lazy Loading Strategy**: Both Braintrust modules are lazy-loaded to avoid initialization issues and reduce startup overhead.

4. **Graceful Degradation**: The system continues to function even if:
   - No API key is provided (local scoring only)
   - LLM is unavailable (falls back to heuristics)
   - Braintrust upload fails (silent failure)

5. **Separation of Scoring and Reporting**: SimplifiedScorer is completely independent of Braintrust, making it testable and reusable.

## Code References

### Core Implementation Files
- `src/evals2/SimpleToolWrapper.ts` - Tool duration tracking wrapper
- `src/evals2/SimplifiedScorer.ts:29-63` - Main scoring orchestration
- `src/evals2/SimpleBraintrustEventManager.ts:91-133` - Session initialization
- `src/evals2/SimpleBraintrustLogger.ts:45-90` - Score upload logic

### Integration Points
- `src/lib/core/NxtScape.ts:293-317` - Task scoring after execution
- `src/lib/core/NxtScape.ts:378-413` - Session initialization
- `src/lib/agent/BrowserAgent.ts:341-344` - Tool wrapping
- `src/lib/runtime/ExecutionContext.ts:60-65` - toolMetrics Map definition

### Configuration
- `src/config.ts:55` - ENABLE_EVALS2 flag
- `src/evals2/config.ts:2-7` - Scoring weights
- `src/evals2/types.ts` - Data structure definitions

## Testing Strategy

The system includes both unit and integration tests:

1. **Unit Tests** ([src/evals2/SimplifiedScorer.test.ts](src/evals2/SimplifiedScorer.test.ts)):
   - Tests individual scoring dimensions
   - Validates tool extraction from messages
   - Checks scoring calculations

2. **Integration Tests** ([src/evals2/integration.test.ts](src/evals2/integration.test.ts)):
   - Verifies tool wrapping functionality
   - Tests scorer with real message structures
   - Validates metrics collection

3. **Config Tests** ([src/evals2/config.test.ts](src/evals2/config.test.ts)):
   - Ensures configuration constants are valid
   - Validates scoring weight totals

## Open Questions

1. **Scoring Model Selection**: The system defaults to gpt-4o-mini for scoring. Is this the optimal choice for balance between cost and quality?

2. **Weight Optimization**: The current weights (40/30/15/15) seem reasonable but could benefit from empirical validation against human evaluations.

3. **Retry Detection Logic**: The current retry detection ([src/evals2/SimplifiedScorer.ts:221-229](src/evals2/SimplifiedScorer.ts:221-229)) uses consecutive same-tool calls. This might miss retries with intermediate steps.

4. **Token Estimation**: The 4 chars/token estimation ([src/evals2/SimplifiedScorer.ts:211](src/evals2/SimplifiedScorer.ts:211)) is rough. Consider using a proper tokenizer for accuracy.

5. **Session Persistence**: Sessions are only tracked in-memory. Consider persisting session data for crash recovery or long-running conversations.