# Evals2 Simplified Implementation Plan

## Overview

Implement a simplified evaluation system (evals2) that combines lightweight tool duration tracking with message-based analysis. The system will use minimal hooks in the existing code and extract all scoring data from the MessageManager history.

// NTN -- youc an use ExecutionContext as well. Need not be just MessageManager

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
- Logs scores to Braintrust for visualization and tracking
- Has only 2 integration points in existing code
- Can be easily enabled/disabled via environment variable

### Key Requirements:
- 4 scoring categories: goal (40%), plan (30%), errors (15%), context (15%)
- Duration tracking via lightweight wrapper (no spans, no telemetry)
- All scoring data extracted from messages post-execution and any maps we create in execution context
- Simple Braintrust logger for uploading scores (no complex spans)
- Use existing LangChainProvider for LLM scoring

## What We're NOT Doing

// NTN -- let's keep parent-child relationships still
- NOT creating complex telemetry spans or parent-child relationships
- NOT using Braintrust's wrapTraced or complex span tracing
- NOT tracking individual tool metrics beyond duration
- NOT modifying execution flow or adding callbacks
- NOT creating session management or experiment infrastructure
- NOT creating a new OpenAI client (use LangChainProvider)
- NOT implementing the full 6-dimensional scoring system

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

// NTN -- need not remove this -- we can just delete not useful ones.
// NTN -- like if we want session id and parent spane we can keep that
// NTN -- we can write a much simpler BrainTrustEventManager
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
├── SimpleToolWrapper.ts      # Lightweight duration tracking
├── SimplifiedScorer.ts       # 4-category scoring from messages
├── SimpleBraintrustLogger.ts # Minimal Braintrust integration
├── types.ts                  # Simple types/schemas with Zod
├── index.ts                  # Clean exports
└── config.ts                 # Configuration constants
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
  // NTN -- let's call this errorFreeExecution
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
  BRAINTRUST_KEY: "BRAINTRUST_API_KEY",
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
import type { ExecutionContext } from '@/lib/runtime/ExecutionContext';

/**
 * Wrap a tool to track execution duration in ExecutionContext
 * Stores metrics in context.toolMetrics Map
 */
export function wrapToolForMetrics(
  tool: DynamicStructuredTool,
  context: ExecutionContext,
  toolCallId: string
): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: tool.name,
    description: tool.description,
    schema: tool.schema,
    func: async (input: any) => {
      const start = Date.now();
      
      try {
        const result = await tool.func(input);
        const duration = Date.now() - start;
        
        // Parse result to check success
        let success = true;
        try {
          const parsed = JSON.parse(result);
          success = parsed.ok !== false;
        } catch {
          // If not JSON, assume success
        }
        
        // Store metrics in ExecutionContext
        if (!context.toolMetrics) {
          context.toolMetrics = new Map();
        }
        context.toolMetrics.set(toolCallId, {
          toolName: tool.name,
          duration,
          success,
          timestamp: start
        });
        
        console.log(`⚡ Tool: ${tool.name} (${duration}ms)`);
        return result;
        
      } catch (error: any) {
        const duration = Date.now() - start;
        
        // Store error metrics
        if (!context.toolMetrics) {
          context.toolMetrics = new Map();
        }
        context.toolMetrics.set(toolCallId, {
          toolName: tool.name,
          duration,
          success: false,
          timestamp: start,
          error: error.message
        });
        
        console.error(`❌ Tool: ${tool.name} failed (${duration}ms)`);
        throw error;
      }
    }
  });
}

export { wrapToolForMetrics as wrapToolForDuration }; // Alias for compatibility
```

#### 2. SimplifiedScorer.ts
**File**: `src/evals2/SimplifiedScorer.ts`
**Changes**: Score from message history

```typescript
import { BaseMessage, AIMessage, ToolMessage } from '@langchain/core/messages';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { getLLM } from '@/lib/llm/LangChainProvider';
import { SCORE_WEIGHTS, DEFAULT_SCORING_MODEL } from './config';
import { ScoreResult, ToolExecution } from './types';

export class SimplifiedScorer {
  private model: string;
  private llm: BaseChatModel | null = null;
  
  constructor(model?: string) {
    this.model = model || process.env.OPENAI_MODEL_FOR_SCORING || DEFAULT_SCORING_MODEL;
  }
  
  private async getLLM(): Promise<BaseChatModel | null> {
    if (!this.llm) {
      try {
        this.llm = await getLLM({ temperature: 0, maxTokens: 100 });
      } catch {
        return null;
      }
    }
    return this.llm;
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
  
  /**
   * Extract tool calls from message history
   * @param messages - Message history from MessageManager
   * @param toolMetrics - Optional metrics Map from ExecutionContext
   */
  private extractToolCalls(messages: BaseMessage[], toolMetrics?: Map<string, any>): ToolExecution[] {
    const toolCalls: ToolExecution[] = [];
    
    // Simple iteration using instanceof
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      
      // Check if it's an AIMessage with tool calls
      if (msg instanceof AIMessage && msg.tool_calls && msg.tool_calls.length > 0) {
        for (const toolCall of msg.tool_calls) {
          // Find the next ToolMessage with matching ID
          const toolMsg = messages.slice(i + 1).find(
            m => m instanceof ToolMessage && m.tool_call_id === toolCall.id
          ) as ToolMessage | undefined;
          
          // Get metrics from ExecutionContext if available
          const metrics = toolMetrics?.get(toolCall.id);
          
          let success = true;
          let error: string | undefined;
          
          if (toolMsg) {
            // Parse tool result to check success
            try {
              const result = JSON.parse(toolMsg.content as string);
              success = result.ok !== false;
              error = result.error;
            } catch {
              // Not JSON, assume success
            }
          }
          
          toolCalls.push({
            toolName: toolCall.name,
            duration: metrics?.duration || 100,  // Use tracked duration or default
            success: metrics?.success ?? success,
            timestamp: metrics?.timestamp || Date.now(),
            args: toolCall.args,
            error: metrics?.error || error
          });
        }
      }
    }
    
    return toolCalls;
  }
  
  private async scoreGoalCompletion(messages: BaseMessage[], query: string): Promise<number> {
    const llm = await this.getLLM();
    if (!llm) {
      // Simple heuristic: check if done_tool was called
      const hasDone = messages.some(msg => 
        msg instanceof AIMessage && 
        msg.tool_calls?.some(tc => tc.name === 'done_tool')
      );
      return hasDone ? 0.8 : 0.3;
    }
    
    // Simple prompt for LLM scoring
    const lastMessages = messages.slice(-5);
    const prompt = `Task: "${query}"

Last 5 messages:
${lastMessages.map(m => `${m.constructor.name}: ${typeof m.content === 'string' ? m.content.slice(0, 100) : '...'}`).join('\n')}

Score task completion (0-1):
1 = fully completed
0.5 = partial  
0 = not done

Reply with ONLY a number:`;

    try {
      const response = await llm.invoke(prompt);
      const content = typeof response.content === 'string' ? response.content : '0.5';
      const score = parseFloat(content.trim());
      return Math.min(1, Math.max(0, isNaN(score) ? 0.5 : score));
    } catch {
      return 0.5;
    }
  }
  
  private async scorePlanCorrectness(toolCalls: ToolExecution[], query: string): Promise<number> {
    const llm = await this.getLLM();
    if (!llm) {
      // Simple heuristic based on tool count and pattern
      if (toolCalls.length === 0) return 0;
      if (toolCalls.length > 20) return 0.3;
      
      const hasPlanning = toolCalls.some(t => 
        t.toolName === 'classification_tool' || 
        t.toolName === 'planner_tool'
      );
      return hasPlanning ? 0.7 : 0.5;
    }
    
    // Simple prompt for plan quality
    const toolSequence = toolCalls.slice(0, 20).map(t => t.toolName).join(' → ');
    const prompt = `Task: "${query}"

Tools: ${toolSequence}

Rate efficiency (0-1):
1 = efficient
0.5 = okay
0 = inefficient

Reply with ONLY a number:`;

    try {
      const response = await llm.invoke(prompt);
      const content = typeof response.content === 'string' ? response.content : '0.5';
      const score = parseFloat(content.trim());
      return Math.min(1, Math.max(0, isNaN(score) ? 0.5 : score));
    } catch {
      return 0.5;
    }
  }
  
  private scoreErrorFreeExecution(toolCalls: ToolExecution[]): number {
    if (toolCalls.length === 0) return 1.0;
    
    const successCount = toolCalls.filter(t => t.success).length;
    const errorCount = toolCalls.filter(t => !t.success).length;
    const retryCount = this.countRetries(toolCalls);
    
    // Simple formula: success ratio minus penalties
    const baseRatio = successCount / toolCalls.length;
    const retryPenalty = retryCount * 0.05;  // 5% per retry
    const errorPenalty = errorCount * 0.10;   // 10% per error
    
    return Math.max(0, baseRatio - retryPenalty - errorPenalty);
  }
  
  private scoreContextEfficiency(messages: BaseMessage[]): number {
    // Simple token estimation: ~4 chars per token
    const totalChars = messages.reduce((sum, msg) => {
      const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
      return sum + content.length;
    }, 0);
    
    const estimatedTokens = totalChars / 4;
    
    // Simple scoring based on requirements
    if (estimatedTokens <= 32000) return 1.0;   // 5/5
    if (estimatedTokens <= 64000) return 0.8;   // 4/5
    if (estimatedTokens <= 128000) return 0.6;  // 3/5
    if (estimatedTokens <= 256000) return 0.4;  // 2/5
    return 0.2;  // 1/5
  }
  
  private countRetries(toolCalls: ToolExecution[]): number {
    let retries = 0;
    for (let i = 1; i < toolCalls.length; i++) {
      // Same tool called consecutively = likely retry
      if (toolCalls[i].toolName === toolCalls[i-1].toolName) {
        retries++;
      }
    }
    return retries;
  }
}
```

#### 3. SimpleBraintrustLogger.ts
**File**: `src/evals2/SimpleBraintrustLogger.ts`
**Changes**: Minimal Braintrust integration for score logging

```typescript
import { BRAINTRUST_API_KEY } from '@/config';
import { ScoreResult } from './types';

// Lazy load Braintrust to avoid module loading issues
let initLogger: any = null;

/**
 * Simple Braintrust logger that only uploads scores
 * No complex spans, no session management, just scores
 */
export class SimpleBraintrustLogger {
  private logger: any = null;
  private initialized: boolean = false;
  
  async initialize(): Promise<boolean> {
    if (this.initialized) return true;
    this.initialized = true;
    
    if (!BRAINTRUST_API_KEY) {
      console.log('%c⚠️ No Braintrust API key, scores won\'t be uploaded', 'color: #ff9900; font-size: 10px');
      return false;
    }
    
    try {
      // Lazy load braintrust module
      if (!initLogger) {
        const braintrust = require('braintrust');
        initLogger = braintrust.initLogger;
      }
      
      // Initialize simple logger (not experiment)
      this.logger = initLogger({
        apiKey: BRAINTRUST_API_KEY,
        projectName: 'browseros-agent-online'
      });
      
      console.log('%c✓ Braintrust logger initialized', 'color: #00ff00; font-size: 10px');
      return true;
    } catch (error) {
      console.warn('Failed to initialize Braintrust:', error);
      return false;
    }
  }
  
  async logTaskScore(
    query: string,
    score: ScoreResult,
    duration_ms: number,
    metadata?: any
  ): Promise<void> {
    if (!this.logger) {
      const success = await this.initialize();
      if (!success) return;
    }
    
    try {
      // Log as a simple traced event with scores
      await this.logger.traced(async (span: any) => {
        span.log({
          input: query,
          output: `Task completed with score: ${score.weightedTotal.toFixed(2)}`,
          scores: {
            // Our 4 simplified scores
            goal_completion: score.goalCompletion,
            plan_correctness: score.planCorrectness,
            success_ratio: score.successRatio,
            context_efficiency: score.contextEfficiency,
            weighted_total: score.weightedTotal
          },
          metadata: {
            type: 'evals2_task',
            duration_ms,
            tool_calls: score.details.toolCalls,
            failed_calls: score.details.failedCalls,
            retries: score.details.retries,
            ...metadata
          }
        });
      }, {
        name: 'evals2_task_score'
      });
      
      console.log('%c📊 Scores uploaded to Braintrust', 'color: #4caf50; font-size: 10px');
    } catch (error) {
      // Silent failure - don't break execution
      console.debug('Failed to log to Braintrust:', error);
    }
  }
  
  async flush(): Promise<void> {
    if (this.logger && this.logger.flush) {
      await this.logger.flush();
    }
  }
}

// Export singleton instance
export const braintrustLogger = new SimpleBraintrustLogger();
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
- [ ] Scores appear in Braintrust dashboard

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
import { wrapToolForMetrics } from '@/evals2/SimpleToolWrapper';

// In _processToolCalls method (around line 630)
let toolFunc = tool.func;

// Add evals2 wrapping (pass tool call ID for metrics tracking)
if (process.env.ENABLE_EVALS2 === 'true') {
  const toolCallId = `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  // NTN -- I think tools might have an id field already
  const wrappedTool = wrapToolForMetrics(tool, this.executionContext, toolCallId);
  toolFunc = wrappedTool.func;
}

const toolResult = await toolFunc(args);
```

#### 2. NxtScape Integration
**File**: `src/lib/core/NxtScape.ts`
**Changes**: Add scoring and Braintrust logging after task completion

```typescript
// Add imports at top
import { SimplifiedScorer } from '@/evals2/SimplifiedScorer';
import { braintrustLogger } from '@/evals2/SimpleBraintrustLogger';

// In _executeAgent method, after successful execution (around line 316)
// Right after: await this.browserAgent.execute(query, metadata);

// Add evals2 scoring and logging
if (process.env.ENABLE_EVALS2 === 'true') {
  const taskStartTime = Date.now();
  
  try {
    // Score the task
    const scorer = new SimplifiedScorer();
    const score = await scorer.scoreFromMessages(
      this.messageManager.getMessages(),
      query,
      this.executionContext.toolMetrics  // Pass tool metrics for duration data
    );
    
    const duration = Date.now() - taskStartTime;
    
    // Log to console
    console.log('Evals2 Score:', {
      goal: score.goalCompletion.toFixed(2),
      plan: score.planCorrectness.toFixed(2),
      errors: score.successRatio.toFixed(2),
      context: score.contextEfficiency.toFixed(2),
      total: score.weightedTotal.toFixed(2)
    });
    
    // Upload to Braintrust
    await braintrustLogger.logTaskScore(
      query,
      score,
      duration,
      {
        selectedTabIds: tabIds || [],
        mode: mode || 'browse'
      }
    );
    
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

#### 3. Update ExecutionContext
**File**: `src/lib/runtime/ExecutionContext.ts`
**Changes**: Add toolMetrics Map

```typescript
export class ExecutionContext {
  // ... existing properties ...
  
  // Add tool metrics Map for evals2
  toolMetrics: Map<string, {
    toolName: string;
    duration: number;
    success: boolean;
    timestamp: number;
    error?: string;
  }> | undefined;
  
  // In reset() method, add:
  public reset(): void {
    // ... existing reset code ...
    this.toolMetrics?.clear();
    this.toolMetrics = undefined;
  }
}
```

#### 4. Update Package.json Scripts
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
- [ ] Scores appear in Braintrust dashboard at https://braintrust.dev/app/Felafax/p/browseros-agent-online/logs
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
1. Set environment variables:
   ```bash
   export ENABLE_EVALS2=true
   export BRAINTRUST_API_KEY=your-key  # From config.ts
   ```
2. Build extension: `npm run build:dev`
3. Execute simple task: "Navigate to google.com"
4. Verify:
   - Console shows 4 scores (goal, plan, errors, context)
   - Braintrust dashboard shows the task with scores
5. Execute complex task: "Find the weather in San Francisco"
6. Verify:
   - Plan score reflects multi-step execution
   - Tool durations are reasonable
   - Scores uploaded to Braintrust

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
- Braintrust scores will appear under 'evals2_task_score' events

## Key Differences from Old System

| Aspect | Old Evals | New Evals2 |
|--------|-----------|------------|
| Scoring Dimensions | 6 (complex weights) | 4 (simple weights) |
| Telemetry | Complex span hierarchy | Single task event |
| Tool Tracking | Braintrust wrapTraced | Simple duration Map |
| LLM Client | Direct OpenAI | LangChainProvider |
| Initialization | Lazy singleton | Direct instantiation |
| Session Management | Yes (parent spans) | No (just task scores) |
| Code Complexity | ~2000 lines | ~500 lines |
| Dependencies | Braintrust SDK, OpenAI | Braintrust SDK only |

## Implementation Summary

This plan creates a drastically simplified evaluation system that:

1. **Reduces complexity** from 2000+ lines to ~500 lines
2. **Keeps Braintrust integration** for score visualization and tracking
3. **Simplifies scoring** from 6 dimensions to 4 clear metrics
4. **Uses existing infrastructure** (LangChainProvider) instead of creating new clients
5. **Minimizes performance impact** with simple Map-based duration tracking
6. **Maintains compatibility** with existing Braintrust dashboards

The key insight is that we don't need complex telemetry infrastructure to get valuable evaluation data. By focusing on the essential metrics (goal completion, plan quality, error rate, context efficiency) and using simple, direct Braintrust logging, we achieve the same visibility with much less code.

## References

- Original research: `thoughts/shared/research/2025-09-04_braintrust_evaluation_research.md`
- Current eval architecture: `docs/CURRENT_EVALS_ARCHITECTURE.md`
- Current eval code: `src/evals/`
- Message types: `src/lib/runtime/MessageManager.ts`
- Tool execution: `src/lib/agent/BrowserAgent.ts:630-640`
- LangChain Provider: `src/lib/llm/LangChainProvider.ts`