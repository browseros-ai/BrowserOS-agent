# Evals2 Gemini 2.5 Pro Enhancement Implementation Plan

## Overview

Enhance the evals2 scoring system to use Gemini 2.5 Pro via LangChain with its full 2M token context window, implement better scoring prompts, leverage ExecutionContext.toolMetrics for time-based efficiency scoring, and use a 10-point scoring scale for higher granularity.

## Current State Analysis

The current implementation uses OpenAI GPT-4o-mini for scoring with simple prompts and 0-1 score ranges. The system already collects toolMetrics in ExecutionContext but doesn't utilize the duration data. Scoring is done through SimplifiedScorer with four dimensions weighted at specific percentages.

### Key Discoveries:
- SimplifiedScorer.getLLM() at line 15-24 creates LLM instances dynamically
- Scoring methods return 0-1 values that need conversion to 1-5 scale
- ExecutionContext.toolMetrics (line 44-50) already tracks duration, success, timestamp
- LangChainProvider supports Google Gemini via ChatGoogleGenerativeAI (line 404)
- Current prompts are minimal and inline (lines 130-140, 168-177)

## Desired End State

After implementation:
- All scoring uses Gemini 2.5 Pro exclusively (hardcoded, no configuration)
- Full untruncated message history passed to LLM (2M context window)
- Rich, detailed prompts for each scoring dimension
- Time-based plan efficiency using actual execution duration
- All scores on 1-10 scale with clear criteria

### Verification:
- Scoring always uses Gemini 2.5 Pro regardless of config
- No truncation of message history (remove slice(-5) limitations)
- Detailed prompts produce more accurate scores
- Plan efficiency correlates with actual execution time
- All scores returned in 1-10 range

## What We're NOT Doing

- Not refactoring the entire scoring architecture
- Not changing the four scoring dimensions or their weights
- Not modifying the Braintrust logging infrastructure
- Not changing how toolMetrics are collected
- Not creating a complex prompt management system
- Not adding score conversion functions (LLM returns 1-10 directly)
- Not adding configuration options for model selection

## Implementation Approach

Minimal refactor approach focusing on three key changes:
1. Force Gemini 2.5 Pro in getLLM() method
2. Create detailed prompts in SimplifiedScorer.prompt.ts file
3. Add time-based scoring helpers (no conversion needed - LLM returns 1-10)

## Phase 1: Setup Gemini Provider and Update Types

### Overview
Configure SimplifiedScorer to always use Gemini 2.5 Pro and update score types to support 1-10 scale.

### Changes Required:

#### 1. Update Score Types
**File**: `src/evals2/types.ts`
**Changes**: Modify score ranges from 0-1 to 1-10

```typescript
// Scoring result schema
export const ScoreResultSchema = z.object({
  goalCompletion: z.number().min(1).max(10),  // How well goal was achieved (1-10 scale)
  planCorrectness: z.number().min(1).max(10),  // Quality and efficiency of the plan (1-10 scale) 
  errorFreeExecution: z.number().min(1).max(10),  // Error-free execution score (1-10 scale)
  contextEfficiency: z.number().min(1).max(10),  // Efficient context usage (1-10 scale)
  weightedTotal: z.number().min(1).max(10),  // Weighted average (1-10 scale)
  details: z.object({  // Scoring details
    toolCalls: z.number(),  // Total number of tool calls
    failedCalls: z.number(),  // Number of failed calls
    retries: z.number(),  // Number of retried calls
    totalDurationMs: z.number().optional(),  // Total execution duration in ms
    reasoning: z.string().optional()  // LLM reasoning
  })
});
```

#### 2. Update Configuration Constants
**File**: `src/evals2/config.ts`
**Changes**: Add Gemini-specific constants

```typescript
// Gemini 2.5 Pro configuration (hardcoded for evals2)
export const GEMINI_SCORING_CONFIG = {
  provider: 'google_gemini',
  modelId: 'gemini-2.5-pro',
  temperature: 0,
  maxTokens: 8192,  // Output tokens for scoring
  contextWindow: 2000000  // 2M token context
} as const;

// Time buckets for plan efficiency scoring (in milliseconds)
// NTN: Using 10-point scale for finer granularity
export const TIME_EFFICIENCY_BUCKETS = {
  perfect: 30000,       // < 30s = 10
  exceptional: 60000,   // < 1 min = 9
  excellent: 120000,    // < 2 min = 8
  veryGood: 180000,     // < 3 min = 7
  good: 240000,         // < 4 min = 6
  average: 300000,      // < 5 min = 5
  belowAverage: 360000, // < 6 min = 4
  poor: 480000,         // < 8 min = 3
  veryPoor: 600000,     // < 10 min = 2
  terrible: Infinity    // > 10 min = 1
} as const;
```

### Success Criteria:

#### Automated Verification:
- [ ] Type checking passes: `npm run typecheck`
- [ ] Existing tests still pass: `npm run test:run -- src/evals2`
- [ ] No linting errors: `npm run lint`

#### Manual Verification:
- [ ] Score types properly validated as 1-10 range
- [ ] Configuration constants accessible

---

## Phase 2: Implement Gemini LLM Integration

### Overview
Modify SimplifiedScorer to always use Gemini 2.5 Pro regardless of configuration.

### Changes Required:

#### 1. Force Gemini Provider in SimplifiedScorer
**File**: `src/evals2/SimplifiedScorer.ts`
**Changes**: Update getLLM() method and add helper methods

```typescript
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { GEMINI_SCORING_CONFIG, TIME_EFFICIENCY_BUCKETS } from './config';

private async getLLM(): Promise<BaseChatModel | null> {
  if (!this.llm) {
    try {
      // Always use Gemini 2.5 Pro for scoring
      const apiKey = process.env.GOOGLE_GENAI_API_KEY || process.env.GEMINI_API_KEY;
      if (!apiKey) {
        console.warn('No Gemini API key found, falling back to default LLM');
        this.llm = await getLLM({ temperature: 0, maxTokens: 100 });
      } else {
        this.llm = new ChatGoogleGenerativeAI({
          model: GEMINI_SCORING_CONFIG.modelId,
          temperature: GEMINI_SCORING_CONFIG.temperature,
          maxOutputTokens: GEMINI_SCORING_CONFIG.maxTokens,
          apiKey: apiKey,
          convertSystemMessageToHumanContent: true
        });
      }
    } catch (error) {
      console.error('Failed to initialize Gemini for scoring:', error);
      return null;
    }
  }
  return this.llm;
}

/**
 * Calculate total duration from tool metrics
 */
private getTotalDuration(toolCalls: ToolExecution[]): number {
  return toolCalls.reduce((sum, tool) => sum + (tool.duration || 0), 0);
}

/**
 * Score efficiency based on execution time
 * NTN: Direct 10-point scale, no conversion needed
 */
private scoreTimeEfficiency(durationMs: number): number {
  if (durationMs <= TIME_EFFICIENCY_BUCKETS.perfect) return 10;
  if (durationMs <= TIME_EFFICIENCY_BUCKETS.exceptional) return 9;
  if (durationMs <= TIME_EFFICIENCY_BUCKETS.excellent) return 8;
  if (durationMs <= TIME_EFFICIENCY_BUCKETS.veryGood) return 7;
  if (durationMs <= TIME_EFFICIENCY_BUCKETS.good) return 6;
  if (durationMs <= TIME_EFFICIENCY_BUCKETS.average) return 5;
  if (durationMs <= TIME_EFFICIENCY_BUCKETS.belowAverage) return 4;
  if (durationMs <= TIME_EFFICIENCY_BUCKETS.poor) return 3;
  if (durationMs <= TIME_EFFICIENCY_BUCKETS.veryPoor) return 2;
  return 1;
}
```

### Success Criteria:

#### Automated Verification:
- [ ] SimplifiedScorer compiles without errors: `npm run build:dev`
- [ ] Unit tests pass: `npm run test:run -- src/evals2/SimplifiedScorer.test.ts`

#### Manual Verification:
- [ ] Gemini provider is used when API key is available
- [ ] Fallback to default LLM works when no Gemini key
- [ ] Helper methods correctly calculate durations and time-based scores

---

## Phase 3: Create Detailed Scoring Prompts

### Overview
Create a new prompts file with rich, detailed prompts for each scoring dimension that leverage the full context and return 10-point scores directly.

### Changes Required:

#### 1. Create Scoring Prompts Module
**File**: `src/evals2/SimplifiedScorer.prompt.ts`
**Changes**: New file with detailed prompts for 10-point scoring

```typescript
import { BaseMessage } from '@langchain/core/messages';
import { ToolExecution } from './types';

/**
 * Scoring prompts for Gemini 2.5 Pro - returns 1-10 scores directly
 * NTN: Leverages full 2M token context, no truncation needed
 */

export function getComprehensiveScoringPrompt(
  messages: BaseMessage[],
  query: string,
  toolCalls: ToolExecution[],
  totalDurationMs: number
): string {
  // Build complete execution context
  const messageHistory = messages.map((msg, idx) => 
    `[${idx}] ${msg._getType()}: ${msg.content}`
  ).join('\n');
  
  const toolSequence = toolCalls.map((tool, idx) => 
    `[${idx}] ${tool.toolName} (${tool.duration}ms, ${tool.success ? '✓' : '✗'})`
  ).join('\n');
  
  const failedTools = toolCalls.filter(t => !t.success);
  const retryCount = countConsecutiveDuplicates(toolCalls);
  
  return `You are an expert evaluator assessing an AI agent's task execution.

## TASK
User Request: "${query}"

## EXECUTION METRICS
- Total Duration: ${totalDurationMs}ms (${(totalDurationMs/1000).toFixed(1)}s)
- Tool Calls: ${toolCalls.length}
- Failed Calls: ${failedTools.length}
- Retries Detected: ${retryCount}

## TOOL EXECUTION SEQUENCE
${toolSequence}

## COMPLETE MESSAGE HISTORY
${messageHistory}

## SCORING INSTRUCTIONS
Analyze the execution and provide scores for each dimension on a 1-10 scale.

### 1. GOAL COMPLETION (Weight: 40%)
Did the agent achieve what the user requested?
- 10: Perfect completion, exceeded expectations
- 9: Fully completed with excellent quality
- 8: Fully completed with good quality
- 7: Mostly completed with minor gaps
- 6: Partially completed, main goal achieved
- 5: Half completed, significant gaps
- 4: Less than half completed
- 3: Minimal progress, mostly incomplete
- 2: Failed with very little progress
- 1: Complete failure, no progress

### 2. PLAN EFFICIENCY (Weight: 30%)
How efficient was the execution plan and timing?
Time Guidelines:
- 10: < 30 seconds - Lightning fast
- 9: < 1 minute - Extremely fast
- 8: < 2 minutes - Very efficient
- 7: < 3 minutes - Efficient
- 6: < 4 minutes - Good
- 5: < 5 minutes - Average
- 4: < 6 minutes - Below average
- 3: < 8 minutes - Slow
- 2: < 10 minutes - Very slow
- 1: > 10 minutes - Extremely slow

Also consider: tool sequence logic, unnecessary steps, optimal path taken.

### 3. ERROR HANDLING (Weight: 15%)
How well were errors and failures managed?
- 10: No errors, flawless execution
- 9: Minor issues handled perfectly
- 8: Good error recovery
- 7: Adequate error handling
- 6: Some errors, mostly recovered
- 5: Multiple errors, partial recovery
- 4: Poor error handling
- 3: Many unhandled errors
- 2: Critical errors not addressed
- 1: Complete failure due to errors

### 4. CONTEXT EFFICIENCY (Weight: 15%)
How efficiently was context/tokens used?
- 10: Extremely concise, minimal tokens
- 9: Very efficient use of context
- 8: Good efficiency
- 7: Reasonable efficiency
- 6: Acceptable usage
- 5: Average efficiency
- 4: Somewhat wasteful
- 3: Inefficient
- 2: Very inefficient
- 1: Extremely wasteful

## OUTPUT FORMAT
Return ONLY a JSON object with integer scores:
{
  "goalCompletion": <1-10>,
  "planEfficiency": <1-10>,
  "errorHandling": <1-10>,
  "contextEfficiency": <1-10>,
  "reasoning": "<Brief explanation of scores>"
}`;
}

function countConsecutiveDuplicates(toolCalls: ToolExecution[]): number {
  let count = 0;
  for (let i = 1; i < toolCalls.length; i++) {
    if (toolCalls[i].toolName === toolCalls[i-1].toolName) {
      count++;
    }
  }
  return count;
}
```

### Success Criteria:

#### Automated Verification:
- [ ] New file compiles: `npm run build:dev`
- [ ] No TypeScript errors: `npm run typecheck`

#### Manual Verification:
- [ ] Prompts are comprehensive and leverage full context
- [ ] Clear 1-10 scoring rubrics defined
- [ ] Prompts utilize tool metrics data
- [ ] Single comprehensive prompt for all dimensions

---

## Phase 4: Update Scoring Methods

### Overview
Modify scoring to use a single comprehensive prompt that returns all dimensions in 1-10 scale, leveraging tool metrics.

### Changes Required:

#### 1. Update scoreFromMessages Method
**File**: `src/evals2/SimplifiedScorer.ts`
**Changes**: Update main scoring orchestration

```typescript
async scoreFromMessages(
  messages: BaseMessage[], 
  query: string,
  toolMetrics?: Map<string, any>
): Promise<ScoreResult> {
  // Extract tool calls with metrics
  const toolCalls = this.extractToolCalls(messages, toolMetrics);
  const totalDurationMs = this.getTotalDuration(toolCalls);
  
  // Get LLM for scoring
  const llm = await this.getLLM();
  
  if (!llm) {
    // Fallback heuristic scoring
    return this.getHeuristicScores(messages, toolCalls, totalDurationMs, query);
  }
  
  // NTN: Single comprehensive prompt for all dimensions
  const prompt = getComprehensiveScoringPrompt(
    messages, 
    query, 
    toolCalls, 
    totalDurationMs
  );
  
  try {
    const response = await llm.invoke(prompt);
    const content = typeof response.content === 'string' ? response.content : '{}';
    const scores = JSON.parse(content);
    
    // Validate and clamp scores to 1-10 range
    const goalScore = Math.min(10, Math.max(1, scores.goalCompletion || 5));
    const planScore = Math.min(10, Math.max(1, scores.planEfficiency || 5));
    const errorScore = Math.min(10, Math.max(1, scores.errorHandling || 5));
    const contextScore = Math.min(10, Math.max(1, scores.contextEfficiency || 5));
    
    // Calculate weighted total (1-10 scale)
    const weightedTotal = 
      goalScore * SCORE_WEIGHTS.goalCompletion +
      planScore * SCORE_WEIGHTS.planCorrectness +
      errorScore * SCORE_WEIGHTS.errorFreeExecution +
      contextScore * SCORE_WEIGHTS.contextEfficiency;
    
    return {
      goalCompletion: goalScore,
      planCorrectness: planScore,
      errorFreeExecution: errorScore,
      contextEfficiency: contextScore,
      weightedTotal: Math.round(weightedTotal),
      details: {
        toolCalls: toolCalls.length,
        failedCalls: toolCalls.filter(t => !t.success).length,
        retries: this.countRetries(toolCalls),
        totalDurationMs,
        reasoning: scores.reasoning || `Scored ${toolCalls.length} tool calls in ${totalDurationMs}ms`
      }
    };
  } catch (error) {
    console.error('LLM scoring failed:', error);
    return this.getHeuristicScores(messages, toolCalls, totalDurationMs, query);
  }
}
```

#### 2. Add Heuristic Fallback Method
**File**: `src/evals2/SimplifiedScorer.ts`
**Changes**: Add fallback scoring when LLM is unavailable

```typescript
/**
 * Heuristic scoring fallback when LLM is unavailable
 * NTN: Returns 1-10 scores based on simple heuristics
 */
private getHeuristicScores(
  messages: BaseMessage[],
  toolCalls: ToolExecution[],
  totalDurationMs: number,
  query: string
): ScoreResult {
  // Goal completion heuristic
  const hasDone = messages.some(msg => 
    msg instanceof AIMessage && 
    msg.tool_calls?.some(tc => tc.name === 'done_tool')
  );
  const goalScore = hasDone ? 7 : 3;
  
  // Plan efficiency based on time
  const planScore = this.scoreTimeEfficiency(totalDurationMs);
  
  // Error handling based on failure rate
  const failureRate = toolCalls.filter(t => !t.success).length / Math.max(1, toolCalls.length);
  const errorScore = Math.round(10 * (1 - failureRate));
  
  // Context efficiency based on message count
  const messageCount = messages.length;
  let contextScore = 5;
  if (messageCount < 10) contextScore = 9;
  else if (messageCount < 20) contextScore = 7;
  else if (messageCount < 30) contextScore = 5;
  else if (messageCount < 50) contextScore = 3;
  else contextScore = 2;
  
  const weightedTotal = 
    goalScore * SCORE_WEIGHTS.goalCompletion +
    planScore * SCORE_WEIGHTS.planCorrectness +
    errorScore * SCORE_WEIGHTS.errorFreeExecution +
    contextScore * SCORE_WEIGHTS.contextEfficiency;
  
  return {
    goalCompletion: goalScore,
    planCorrectness: planScore,
    errorFreeExecution: errorScore,
    contextEfficiency: contextScore,
    weightedTotal: Math.round(weightedTotal),
    details: {
      toolCalls: toolCalls.length,
      failedCalls: toolCalls.filter(t => !t.success).length,
      retries: this.countRetries(toolCalls),
      totalDurationMs,
      reasoning: 'Heuristic scoring (LLM unavailable)'
    }
  };
}
```

### Success Criteria:

#### Automated Verification:
- [ ] All tests pass: `npm run test:run -- src/evals2`
- [ ] Integration test works: `npm run test:run -- src/evals2/integration.test.ts`
- [ ] Build succeeds: `npm run build:dev`

#### Manual Verification:
- [ ] Scores are returned in 1-10 range
- [ ] Time-based efficiency properly calculated with 10 buckets
- [ ] Full message history used (no truncation)
- [ ] Tool metrics properly integrated
- [ ] Single LLM call returns all dimensions

---

## Phase 5: Testing and Validation

### Overview
Add tests to verify the new scoring system works correctly with Gemini and 1-5 scale.

### Changes Required:

#### 1. Update Unit Tests
**File**: `src/evals2/SimplifiedScorer.test.ts`
**Changes**: Add tests for new functionality

```typescript
describe('SimplifiedScorer with Gemini', () => {
  it('tests that scores are in 1-10 range', async () => {
    const scorer = new SimplifiedScorer();
    const messages = [/* test messages */];
    const score = await scorer.scoreFromMessages(messages, 'test query');
    
    expect(score.goalCompletion).toBeGreaterThanOrEqual(1);
    expect(score.goalCompletion).toBeLessThanOrEqual(10);
    expect(score.weightedTotal).toBeGreaterThanOrEqual(1);
    expect(score.weightedTotal).toBeLessThanOrEqual(10);
  });
  
  it('tests that time efficiency scoring works', async () => {
    const scorer = new SimplifiedScorer();
    const toolMetrics = new Map([
      ['call_1', { toolName: 'test', duration: 30000, success: true, timestamp: Date.now() }],
      ['call_2', { toolName: 'test2', duration: 15000, success: true, timestamp: Date.now() }]
    ]);
    
    const score = await scorer.scoreFromMessages([], 'test', toolMetrics);
    expect(score.details.totalDurationMs).toBe(45000); // 45 seconds total
    // Should get high efficiency score (8-9) for < 1 minute
  });
  
  it('tests that heuristic fallback works', async () => {
    // Test without LLM available
    const scorer = new SimplifiedScorer();
    // Mock getLLM to return null
    scorer['llm'] = null;
    
    const messages = [/* test messages with done_tool */];
    const score = await scorer.scoreFromMessages(messages, 'test query');
    
    expect(score.details.reasoning).toContain('Heuristic');
    expect(score.goalCompletion).toBeGreaterThanOrEqual(1);
    expect(score.goalCompletion).toBeLessThanOrEqual(10);
  });
});
```

### Success Criteria:

#### Automated Verification:
- [ ] All new tests pass: `npm run test:run -- src/evals2/SimplifiedScorer.test.ts`
- [ ] No regression in existing tests: `npm run test:run -- src/evals2`
- [ ] Type checking passes: `npm run typecheck`
- [ ] Linting passes: `npm run lint`

#### Manual Verification:
- [ ] Scoring system uses Gemini when API key available
- [ ] Scores consistently in 1-10 range
- [ ] Time-based efficiency correlates with actual duration (10 buckets)
- [ ] Full context utilized without truncation
- [ ] Heuristic fallback works when LLM unavailable

---

## Testing Strategy

### Unit Tests:
- Test 1-10 score range validation
- Test time efficiency buckets (10 levels)
- Test tool metrics extraction and duration calculation
- Test Gemini provider initialization
- Test heuristic fallback scoring

### Integration Tests:
- Run actual scoring with Gemini API
- Verify full context handling (large message arrays)
- Test fallback behavior without API key
- Validate scoring consistency

### Manual Testing Steps:
1. Set GOOGLE_GENAI_API_KEY or GEMINI_API_KEY environment variable
2. Run evals2 integration test with real agent execution
3. Verify scores are in 1-10 range
4. Check that execution time maps to correct efficiency bucket (1-10)
5. Confirm Gemini model is being used (check logs)
6. Test heuristic fallback by running without API key

## Performance Considerations

- Gemini 2.5 Pro can handle 2M tokens but responses are limited to 8192 tokens
- No truncation needed for input context
- Scoring latency may increase slightly with Gemini vs GPT-4o-mini
- Cache LLM instance to avoid re-initialization

## Migration Notes

- Environment variable required: GOOGLE_GENAI_API_KEY or GEMINI_API_KEY
- Existing scores in Braintrust will shift from 0-1 to 1-10 scale
- Consider running parallel scoring for validation period

## References

- Original requirements: User request in this conversation
- LangChain Gemini docs: @langchain/google-genai package
- Similar implementation: `src/evals/scoring/LLMJudge.prompts.ts:10-166`
- Tool metrics source: `src/lib/runtime/ExecutionContext.ts:44-50`

## Summary of Key Changes (Per NTN Feedback)

### 10-Point Scale Implementation
- **Direct 10-point scoring**: LLM returns 1-10 scores directly, no conversion needed
- **Removed conversion function**: No `convertToFivePointScale()` function
- **10 time efficiency buckets**: Finer granularity from 30s to 10+ minutes
- **Heuristic fallback**: Returns 1-10 scores when LLM unavailable

### Prompt Architecture
- **Single comprehensive prompt**: One LLM call for all dimensions
- **File location**: `SimplifiedScorer.prompt.ts` (not ScoringPrompts.ts)
- **Full context utilization**: No truncation, leverages Gemini's 2M token window
- **Structured JSON output**: LLM returns all scores in one JSON response

### Scoring Dimensions (1-10 scale)
1. **Goal Completion** (40%): 10=Perfect, 5=Half done, 1=Complete failure
2. **Plan Efficiency** (30%): Time-based with 10 buckets + sequence logic
3. **Error Handling** (15%): 10=Flawless, 5=Partial recovery, 1=Critical failures
4. **Context Efficiency** (15%): 10=Minimal tokens, 5=Average, 1=Extremely wasteful

### Implementation Strategy
- **Minimal refactor**: Keep existing structure, update scoring logic only
- **Hardcoded Gemini**: Always use Gemini 2.5 Pro, no configuration changes
- **Comprehensive testing**: Unit tests for 10-point scale, time buckets, and fallback