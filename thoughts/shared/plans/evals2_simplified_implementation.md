# Evals2 Simplified Implementation Plan

## Overview

Implement a simplified evaluation system (evals2) that combines lightweight tool duration tracking with message-based analysis. The system will use minimal hooks in the existing code and extract all scoring data from the MessageManager history.

## Current State Analysis

The current evaluation system in `src/evals/` has:
- Complex telemetry with Braintrust integration (BraintrustEventCollector)
- Dynamic tool wrapping with createTrackedTool
- Multi-dimensional LLM scoring with 6 categories
- Tight coupling to NxtScape and BrowserAgent
- Session and task tracking with parent-child spans

### Key Discoveries:
- Tool wrapping happens at execution time in `BrowserAgent._processToolCalls()` (line 632-635)
- Telemetry initialization in `NxtScape._initializeTelemetrySession()` (line 532-576)
- Task finalization with scoring in `NxtScape._finalizeTask()` (line 619-817)
- LLMJudge accesses ExecutionContext directly (line 111-200)

## Desired End State

A clean, simple evaluation system in `src/evals2/` that:
- Tracks tool duration with minimal overhead (just Date.now() calls)
- Scores executions based on MessageManager history
- Uses 4 scoring categories with specific weights
- Has only 2 integration points in existing code
- Can be easily enabled/disabled via environment variable

### Key Requirements:
- 4 scoring categories: goal (40%), plan (30%), errors (15%), context (15%)
- Duration tracking via lightweight wrapper (no spans, no telemetry)
- All scoring data extracted from messages post-execution
- No singletons, no complex initialization

## What We're NOT Doing

- NOT creating complex telemetry spans or parent-child relationships
- NOT using Braintrust's wrapTraced or telemetry infrastructure
- NOT tracking individual tool metrics beyond duration
- NOT modifying execution flow or adding callbacks
- NOT creating session management or experiment infrastructure
- NOT adding any runtime dependencies beyond OpenAI for scoring

## Implementation Approach

Hybrid approach combining:
1. **Lightweight tool wrapping** - ONLY for precise duration tracking
2. **Message analysis** - Everything else inferred from MessageManager
3. **Post-execution scoring** - Score after task completion using message history
4. **Minimal integration** - Just 2 hooks in existing code

## Phase 1: Remove Old Eval Hooks

### Overview
Clean up existing telemetry and evaluation hooks from the main codebase.

### Changes Required:

#### 1. NxtScape.ts
**File**: `src/lib/core/NxtScape.ts`
**Changes**: Remove telemetry imports and usage

```typescript
// Remove these imports (lines 11-16)
- import { BraintrustEventCollector } from "@/evals/BraintrustEventCollector";
- import { LLMJudge } from "@/evals/scoring/LLMJudge";
- import { BRAINTRUST_API_KEY } from "@/config";

// Remove telemetry properties (lines 71-78)
- private telemetrySessionId: string | null = null;
- private telemetryParentSpan: string | null = null;
- private telemetry: BraintrustEventCollector | null = null;
- private conversationStartTime: number = 0;
- private taskCount: number = 0;
- private taskStartTime: number = 0;
- private sessionWeightedTotals: number[] = [];
- private experimentId: string | null = null;

// Remove telemetry initialization (lines 256-297)
// Remove telemetry session methods (lines 528-817)
// Remove _initializeTelemetrySession()
// Remove _endTelemetrySession()
// Remove _finalizeTask()
```

#### 2. BrowserAgent.ts
**File**: `src/lib/agent/BrowserAgent.ts`
**Changes**: Remove tool wrapping

```typescript
// Remove import (line 76)
- import { createTrackedTool } from '@/evals/tool-wrapper';

// Remove telemetry wrapping (lines 631-635)
- if (this.executionContext.telemetry?.isEnabled() && this.executionContext.parentSpanId) {
-   const wrappedTool = createTrackedTool(tool, this.executionContext);
-   toolFunc = wrappedTool.func;
- }
```

#### 3. ExecutionContext.ts
**File**: `src/lib/runtime/ExecutionContext.ts`
**Changes**: Remove telemetry references

```typescript
// Remove telemetry properties
- telemetry: BraintrustEventCollector | null
- parentSpanId: string | null
```

### Success Criteria:

#### Automated Verification:
- [ ] Code compiles: `npm run build`
- [ ] Type checking passes: `npm run typecheck`
- [ ] No remaining imports from `@/evals/`: `grep -r "@/evals" src/lib/`

#### Manual Verification:
- [ ] Extension loads without errors
- [ ] Tasks execute normally without telemetry

---

## Phase 2: Create Evals2 Structure

### Overview
Create the new simplified evaluation system directory structure.

### Changes Required:

#### 1. Create Directory Structure
**Files to create**:
```
src/evals2/
├── SimpleToolWrapper.ts    # Lightweight duration tracking
├── SimplifiedScorer.ts      # 4-category scoring from messages
├── types.ts                 # Simple types/schemas with Zod
├── index.ts                 # Clean exports
└── config.ts                # Configuration constants
```

#### 2. types.ts
**File**: `src/evals2/types.ts`
**Changes**: Define core types with Zod

```typescript
import { z } from "zod";

// Tool execution metadata schema
export const ToolExecutionSchema = z.object({
  toolName: z.string(),  // Name of the tool
  duration: z.number(),  // Duration in milliseconds
  success: z.boolean(),  // Whether tool succeeded (ok: true/false)
  timestamp: z.number(),  // When tool was executed
  args: z.any().optional(),  // Tool arguments
  error: z.string().optional()  // Error message if failed
});

export type ToolExecution = z.infer<typeof ToolExecutionSchema>;

// Scoring result schema
export const ScoreResultSchema = z.object({
  goalCompletion: z.number().min(0).max(1),  // How well goal was achieved
  planCorrectness: z.number().min(0).max(1),  // Quality of the plan
  successRatio: z.number().min(0).max(1),  // Error-free execution ratio
  contextEfficiency: z.number().min(0).max(1),  // Efficient context usage
  weightedTotal: z.number().min(0).max(1),  // Weighted average
  details: z.object({  // Scoring details
    toolCalls: z.number(),  // Total number of tool calls
    failedCalls: z.number(),  // Number of failed calls
    retries: z.number(),  // Number of retried calls
    reasoning: z.string().optional()  // LLM reasoning
  })
});

export type ScoreResult = z.infer<typeof ScoreResultSchema>;

// Duration storage options
export const DurationStorageSchema = z.enum(["result", "context", "collector"]);
export type DurationStorage = z.infer<typeof DurationStorageSchema>;
```

#### 3. config.ts
**File**: `src/evals2/config.ts`
**Changes**: Configuration constants

```typescript
// Scoring weights
export const SCORE_WEIGHTS = {
  goalCompletion: 0.40,    // 40% - Most important
  planCorrectness: 0.30,   // 30% - Plan quality
  successRatio: 0.15,      // 15% - Error handling
  contextEfficiency: 0.15  // 15% - Efficiency
} as const;

// Default scoring model
export const DEFAULT_SCORING_MODEL = "gpt-4o-mini";

// Environment variable names
export const ENV_VARS = {
  ENABLE: "ENABLE_EVALS2",
  OPENAI_KEY: "OPENAI_API_KEY_FOR_SCORING",
  SCORING_MODEL: "OPENAI_MODEL_FOR_SCORING"
} as const;
```

### Success Criteria:

#### Automated Verification:
- [ ] New directory exists: `test -d src/evals2`
- [ ] All files created: `ls src/evals2/*.ts | wc -l` returns 5
- [ ] Types compile: `npm run typecheck`

#### Manual Verification:
- [ ] Directory structure matches specification
- [ ] Type definitions are complete

---

## Phase 3: Implement Core Components

### Overview
Implement the lightweight tool wrapper and simplified scorer.

### Changes Required:

#### 1. SimpleToolWrapper.ts
**File**: `src/evals2/SimpleToolWrapper.ts`
**Changes**: Minimal duration tracking wrapper

```typescript
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';

// Simple in-memory storage for durations
const toolDurations = new Map<string, number>();

/**
 * Wrap a tool to track execution duration
 * Minimal overhead - just Date.now() calls
 */
export function wrapToolForDuration(tool: DynamicStructuredTool): DynamicStructuredTool {
  const originalFunc = tool.func;
  
  const wrappedFunc = async (input: any) => {
    const start = Date.now();
    const callId = `${tool.name}_${start}`;
    
    try {
      const result = await originalFunc(input);
      const duration = Date.now() - start;
      
      // Store duration for later retrieval
      toolDurations.set(callId, duration);
      
      // Option A: Add duration to result metadata
      try {
        const parsed = JSON.parse(result);
        parsed._metrics = { duration_ms: duration };
        return JSON.stringify(parsed);
      } catch {
        // If not JSON, return as-is
        return result;
      }
    } catch (error) {
      const duration = Date.now() - start;
      toolDurations.set(callId, duration);
      throw error;
    }
  };
  
  return new DynamicStructuredTool({
    name: tool.name,
    description: tool.description,
    schema: tool.schema,
    func: wrappedFunc
  });
}

// Helper to get all durations and clear
export function getAndClearDurations(): Map<string, number> {
  const durations = new Map(toolDurations);
  toolDurations.clear();
  return durations;
}
```

#### 2. SimplifiedScorer.ts
**File**: `src/evals2/SimplifiedScorer.ts`
**Changes**: Score from message history

```typescript
import { BaseMessage, AIMessage, ToolMessage } from '@langchain/core/messages';
import { SCORE_WEIGHTS, DEFAULT_SCORING_MODEL } from './config';
import { ScoreResult, ToolExecution } from './types';

export class SimplifiedScorer {
  private model: string;
  
  constructor(model?: string) {
    this.model = model || process.env.OPENAI_MODEL_FOR_SCORING || DEFAULT_SCORING_MODEL;
  }
  
  /**
   * Score task completion from message history
   */
  async scoreFromMessages(
    messages: BaseMessage[], 
    query: string
  ): Promise<ScoreResult> {
    // Extract tool calls from messages
    const toolCalls = this.extractToolCalls(messages);
    
    // Calculate individual scores
    const goalScore = await this.scoreGoalCompletion(messages, query);
    const planScore = this.scorePlanCorrectness(toolCalls, query);
    const errorScore = this.scoreSuccessRatio(toolCalls);
    const contextScore = this.scoreContextEfficiency(messages, toolCalls);
    
    // Calculate weighted total
    const weightedTotal = 
      goalScore * SCORE_WEIGHTS.goalCompletion +
      planScore * SCORE_WEIGHTS.planCorrectness +
      errorScore * SCORE_WEIGHTS.successRatio +
      contextScore * SCORE_WEIGHTS.contextEfficiency;
    
    return {
      goalCompletion: goalScore,
      planCorrectness: planScore,
      successRatio: errorScore,
      contextEfficiency: contextScore,
      weightedTotal,
      details: {
        toolCalls: toolCalls.length,
        failedCalls: toolCalls.filter(t => !t.success).length,
        retries: this.countRetries(toolCalls),
        reasoning: `Scored ${toolCalls.length} tool calls for query: ${query}`
      }
    };
  }
  
  private extractToolCalls(messages: BaseMessage[]): ToolExecution[] {
    const toolCalls: ToolExecution[] = [];
    
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      
      // Find AI messages with tool calls
      if (msg._getType() === 'ai') {
        const aiMsg = msg as AIMessage;
        if (aiMsg.tool_calls && aiMsg.tool_calls.length > 0) {
          // Look for corresponding tool result
          for (const toolCall of aiMsg.tool_calls) {
            const toolResult = messages.slice(i + 1).find(
              m => m._getType() === 'tool' && 
                   (m as ToolMessage).tool_call_id === toolCall.id
            ) as ToolMessage | undefined;
            
            if (toolResult) {
              const result = this.parseToolResult(toolResult.content as string);
              toolCalls.push({
                toolName: toolCall.name,
                duration: result.duration || 100, // Default if not tracked
                success: result.ok !== false,
                timestamp: Date.now(),
                args: toolCall.args,
                error: result.error
              });
            }
          }
        }
      }
    }
    
    return toolCalls;
  }
  
  private parseToolResult(content: string): any {
    try {
      const parsed = JSON.parse(content);
      // Check for duration in metadata
      if (parsed._metrics?.duration_ms) {
        parsed.duration = parsed._metrics.duration_ms;
      }
      return parsed;
    } catch {
      return { output: content, ok: true };
    }
  }
  
  private async scoreGoalCompletion(messages: BaseMessage[], query: string): Promise<number> {
    // Use LLM to assess if goal was completed
    // For now, simple heuristic: check if DoneTool was called successfully
    const doneToolCalled = messages.some(msg => {
      if (msg._getType() === 'ai') {
        const aiMsg = msg as AIMessage;
        return aiMsg.tool_calls?.some(tc => tc.name === 'done_tool');
      }
      return false;
    });
    
    return doneToolCalled ? 0.9 : 0.3;
  }
  
  private scorePlanCorrectness(toolCalls: ToolExecution[], query: string): number {
    // Assess plan quality based on tool sequence
    // Heuristics: logical order, no excessive loops, appropriate tools
    
    if (toolCalls.length === 0) return 0.0;
    if (toolCalls.length > 20) return 0.3; // Too many calls
    
    // Check for classification → planning → execution pattern
    const hasClassification = toolCalls.some(t => t.toolName === 'classification_tool');
    const hasPlanning = toolCalls.some(t => t.toolName === 'planner_tool');
    
    if (hasClassification && hasPlanning) return 0.8;
    if (hasClassification || hasPlanning) return 0.6;
    return 0.5;
  }
  
  private scoreSuccessRatio(toolCalls: ToolExecution[]): number {
    if (toolCalls.length === 0) return 1.0;
    
    const successCount = toolCalls.filter(t => t.success).length;
    return successCount / toolCalls.length;
  }
  
  private scoreContextEfficiency(messages: BaseMessage[], toolCalls: ToolExecution[]): number {
    // Assess efficient use of context
    // Metrics: message count, redundant calls, context switches
    
    const messageCount = messages.length;
    const retries = this.countRetries(toolCalls);
    
    // Penalize excessive messages or retries
    if (messageCount > 50) return 0.3;
    if (retries > 3) return 0.4;
    if (messageCount > 30) return 0.6;
    if (retries > 1) return 0.7;
    
    return 0.9;
  }
  
  private countRetries(toolCalls: ToolExecution[]): number {
    let retries = 0;
    let lastTool = '';
    
    for (const call of toolCalls) {
      if (call.toolName === lastTool && !call.success) {
        retries++;
      }
      lastTool = call.toolName;
    }
    
    return retries;
  }
}
```

### Success Criteria:

#### Automated Verification:
- [ ] Components compile: `npm run build`
- [ ] No type errors: `npm run typecheck`
- [ ] Unit tests pass: `npm test src/evals2`

#### Manual Verification:
- [ ] Tool wrapper adds minimal overhead (<5ms)
- [ ] Scorer extracts correct tool calls from messages
- [ ] Scores are in 0-1 range

---

## Phase 4: Add Integration Hooks

### Overview
Add minimal hooks in existing code to enable evals2.

### Changes Required:

#### 1. BrowserAgent Integration
**File**: `src/lib/agent/BrowserAgent.ts`
**Changes**: Add conditional tool wrapping

```typescript
// Add import at top
import { wrapToolForDuration } from '@/evals2/SimpleToolWrapper';

// In _processToolCalls method (around line 630)
let toolFunc = tool.func;

// Add evals2 wrapping
if (process.env.ENABLE_EVALS2 === 'true') {
  const wrappedTool = wrapToolForDuration(tool);
  toolFunc = wrappedTool.func;
}

const toolResult = await toolFunc(args);
```

#### 2. NxtScape Integration
**File**: `src/lib/core/NxtScape.ts`
**Changes**: Add scoring after task completion

```typescript
// Add import at top
import { SimplifiedScorer } from '@/evals2/SimplifiedScorer';

// In _executeAgent method, after successful execution (around line 316)
// Right after: await this.browserAgent.execute(query, metadata);

// Add evals2 scoring
if (process.env.ENABLE_EVALS2 === 'true') {
  try {
    const scorer = new SimplifiedScorer();
    const score = await scorer.scoreFromMessages(
      this.messageManager.getMessages(),
      query
    );
    
    console.log('Evals2 Score:', {
      goal: score.goalCompletion.toFixed(2),
      plan: score.planCorrectness.toFixed(2),
      errors: score.successRatio.toFixed(2),
      context: score.contextEfficiency.toFixed(2),
      total: score.weightedTotal.toFixed(2)
    });
    
    // Optionally save to file or send somewhere
    if (process.env.EVALS2_OUTPUT_FILE) {
      const fs = await import('fs/promises');
      await fs.appendFile(
        process.env.EVALS2_OUTPUT_FILE,
        JSON.stringify({ query, score, timestamp: Date.now() }) + '\n'
      );
    }
  } catch (error) {
    console.warn('Evals2 scoring failed:', error);
    // Don't break execution if scoring fails
  }
}
```

### Success Criteria:

#### Automated Verification:
- [ ] Code compiles with hooks: `npm run build`
- [ ] Extension loads: `npm run build:dev`
- [ ] Environment variable check works: `ENABLE_EVALS2=true npm test`

#### Manual Verification:
- [ ] Tool durations are tracked when enabled
- [ ] Scores are logged to console when enabled
- [ ] No impact when disabled (default)
- [ ] Scoring errors don't break execution

---

## Phase 5: Testing & Cleanup

### Overview
Test the new system and clean up any remaining old code.

### Changes Required:

#### 1. Create Test File
**File**: `src/evals2/SimplifiedScorer.test.ts`
**Changes**: Basic unit tests

```typescript
import { describe, it, expect } from 'vitest';
import { SimplifiedScorer } from './SimplifiedScorer';
import { HumanMessage, AIMessage, ToolMessage } from '@langchain/core/messages';

describe('SimplifiedScorer', () => {
  it('tests that the scorer can be created', () => {
    const scorer = new SimplifiedScorer();
    expect(scorer).toBeDefined();
  });
  
  it('tests that scoring handles empty messages', async () => {
    const scorer = new SimplifiedScorer();
    const score = await scorer.scoreFromMessages([], 'test query');
    expect(score.weightedTotal).toBeGreaterThanOrEqual(0);
    expect(score.weightedTotal).toBeLessThanOrEqual(1);
  });
  
  it('tests that tool calls are extracted correctly', async () => {
    const messages = [
      new HumanMessage('test'),
      new AIMessage({
        content: '',
        tool_calls: [{
          id: 'call_1',
          name: 'test_tool',
          args: { input: 'test' }
        }]
      }),
      new ToolMessage({
        content: JSON.stringify({ ok: true, output: 'result' }),
        tool_call_id: 'call_1'
      })
    ];
    
    const scorer = new SimplifiedScorer();
    const score = await scorer.scoreFromMessages(messages, 'test');
    expect(score.details.toolCalls).toBe(1);
    expect(score.details.failedCalls).toBe(0);
  });
});
```

#### 2. Remove Old Evals Directory
**Actions**:
```bash
# After confirming new system works
rm -rf src/evals/
```

#### 3. Update Package.json Scripts
**File**: `package.json`
**Changes**: Add evals2 test script

```json
{
  "scripts": {
    "test:evals2": "ENABLE_EVALS2=true vitest run src/evals2"
  }
}
```

### Success Criteria:

#### Automated Verification:
- [ ] Unit tests pass: `npm run test:evals2`
- [ ] No references to old evals: `grep -r "src/evals/" src/`
- [ ] Build succeeds: `npm run build`
- [ ] Linting passes: `npm run lint`

#### Manual Verification:
- [ ] Extension works with ENABLE_EVALS2=true
- [ ] Scores are reasonable for sample tasks
- [ ] No performance degradation
- [ ] Clean console output

---

## Testing Strategy

### Unit Tests:
- Test SimplifiedScorer with mock messages
- Test SimpleToolWrapper duration tracking
- Test score calculations with edge cases

### Integration Tests:
- Run simple task with evals2 enabled
- Verify scores are in expected range
- Check duration tracking accuracy

### Manual Testing Steps:
1. Build extension with `ENABLE_EVALS2=true`
2. Execute task: "Navigate to google.com"
3. Verify console shows scores
4. Execute complex task: "Find the weather in San Francisco"
5. Verify plan score reflects multi-step execution
6. Check that durations are reasonable

## Performance Considerations

- Tool wrapping adds ~1ms overhead per call (just Date.now())
- Scoring happens after execution (no runtime impact)
- Message extraction is O(n) where n = message count
- No memory leaks (durations cleared after scoring)

## Migration Notes

- Environment variable controls migration: ENABLE_EVALS2
- Can run both systems in parallel during transition
- Old telemetry can be removed after validation
- Scores may differ slightly due to simplified heuristics

## References

- Original research: `thoughts/shared/research/2025-09-04_braintrust_evaluation_research.md`
- Current eval code: `src/evals/`
- Message types: `src/lib/runtime/MessageManager.ts`
- Tool execution: `src/lib/agent/BrowserAgent.ts:630-640`