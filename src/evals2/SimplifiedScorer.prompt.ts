import { BaseMessage, AIMessage } from '@langchain/core/messages';
import { ToolExecution } from './types';
import { TokenCounter } from '@/lib/utils/TokenCounter';

/**
 * Individual scoring prompts for Gemini 2.5 Pro - each dimension scored separately
 * NTN: Focused prompts with only required context for each dimension
 */

/**
 * Score goal completion - did the agent achieve what was asked?
 */
export function getGoalCompletionPrompt(
  query: string,
  messages: BaseMessage[],
  toolCalls: ToolExecution[]
): string {
  // Extract key signals of completion
  const hasDoneTool = messages.some(msg => 
    msg instanceof AIMessage && 
    msg.tool_calls?.some(tc => tc.name === 'done_tool')
  );
  
  // Get last few messages to understand final state
  const lastMessages = messages.slice(-5).map((msg, idx) => 
    `[${idx}] ${msg._getType()}: ${typeof msg.content === 'string' ? msg.content.slice(0, 200) : '...'}`
  ).join('\n');
  
  // Extract any results or extracted data
  const resultTools = toolCalls.filter(t => 
    t.toolName === 'result_tool' || 
    t.toolName === 'extract_tool' ||
    t.toolName === 'done_tool'
  );
  
  return `Evaluate if an AI agent completed the user's goal.

## USER REQUEST
"${query}"

## EXECUTION SUMMARY
- Total tools executed: ${toolCalls.length}
- Done tool called: ${hasDoneTool ? 'Yes' : 'No'}
- Result/Extract tools used: ${resultTools.length}

## FINAL MESSAGES (last 5)
${lastMessages}

## KEY TOOL RESULTS
${resultTools.map(t => `${t.toolName}: success=${t.success}`).join('\n') || 'No result tools used'}

## SCORING INSTRUCTIONS
Rate goal completion on a 1-10 scale:

10: Perfect - Task fully completed, results delivered clearly
9: Excellent - Task completed with all requirements met
8: Very Good - Task completed with minor gaps
7: Good - Main goal achieved, some details missing
6: Satisfactory - Core task done but incomplete
5: Partial - About half completed
4: Limited - Less than half done
3: Minimal - Very little progress
2: Failed - Almost no progress
1: Complete Failure - Nothing accomplished

Consider:
- Was the specific request fulfilled?
- If user asked for information, was it provided?
- If user asked for an action, was it performed?
- If done_tool was called, task was likely completed

Return ONLY a number between 1-10:`;
}

/**
 * Score plan efficiency - was the execution efficient and well-planned?
 */
export function getPlanEfficiencyPrompt(
  query: string,
  toolCalls: ToolExecution[],
  totalDurationMs: number
): string {
  // Analyze tool sequence for patterns
  const toolSequence = toolCalls.map(t => t.toolName).join(' → ');
  const uniqueTools = new Set(toolCalls.map(t => t.toolName)).size;
  const retries = countConsecutiveDuplicates(toolCalls);
  
  // Check for planning tools
  const hasPlanning = toolCalls.some(t => 
    t.toolName === 'classification_tool' || 
    t.toolName === 'planner_tool'
  );
  
  // Time efficiency
  const durationSeconds = totalDurationMs / 1000;
  const avgTimePerTool = totalDurationMs / Math.max(1, toolCalls.length);
  
  return `Evaluate the efficiency of an AI agent's execution plan.

## TASK
"${query}"

## EXECUTION METRICS
- Duration: ${durationSeconds.toFixed(1)} seconds
- Tool calls: ${toolCalls.length}
- Unique tools: ${uniqueTools}
- Consecutive retries: ${retries}
- Used planning: ${hasPlanning ? 'Yes' : 'No'}
- Avg time per tool: ${(avgTimePerTool/1000).toFixed(1)}s

## TOOL SEQUENCE
${toolSequence || 'No tools executed'}

## SCORING INSTRUCTIONS
Rate execution efficiency on a 1-10 scale:

10: Lightning fast (<30s), optimal tool sequence
9: Very fast (<1min), efficient path
8: Fast (<2min), good decisions
7: Quick (<3min), mostly efficient
6: Reasonable (<4min), acceptable path
5: Average (<5min), some inefficiency
4: Slow (<6min), redundant steps
3: Very slow (<8min), poor planning
2: Extremely slow (<10min), many issues
1: Terrible (>10min), excessive redundancy

Consider:
- Execution time vs task complexity
- Tool sequence logic
- Unnecessary repetitions
- Whether planning was needed/used appropriately

Return ONLY a number between 1-10:`;
}

/**
 * Score error handling - how well were errors managed?
 */
export function getErrorHandlingPrompt(
  toolCalls: ToolExecution[]
): string {
  const totalCalls = toolCalls.length;
  const failedCalls = toolCalls.filter(t => !t.success);
  const failureRate = totalCalls > 0 ? (failedCalls.length / totalCalls) * 100 : 0;
  
  // Analyze error patterns
  const errorMessages = failedCalls
    .filter(t => t.error)
    .map(t => `${t.toolName}: ${t.error}`)
    .slice(0, 5);
  
  // Check for recovery attempts
  const recoveryAttempts = analyzeRecoveryPatterns(toolCalls);
  
  return `Evaluate how well an AI agent handled errors during execution.

## ERROR STATISTICS
- Total tool calls: ${totalCalls}
- Failed calls: ${failedCalls.length}
- Failure rate: ${failureRate.toFixed(1)}%
- Recovery attempts: ${recoveryAttempts}

## ERROR DETAILS (first 5)
${errorMessages.join('\n') || 'No errors occurred'}

## FAILED TOOLS
${failedCalls.map(t => t.toolName).join(', ') || 'None'}

## SCORING INSTRUCTIONS
Rate error handling on a 1-10 scale:

10: Flawless - No errors occurred
9: Excellent - Minor issues handled perfectly
8: Very Good - Errors recovered gracefully
7: Good - Most errors handled well
6: Adequate - Some recovery from errors
5: Mixed - Half of errors handled
4: Poor - Many unhandled errors
3: Very Poor - Most errors not addressed
2: Critical - Errors caused major issues
1: Complete Failure - Errors prevented any progress

Consider:
- If no errors occurred, score 10
- If errors occurred, was recovery attempted?
- Did errors block task completion?
- Were errors handled gracefully?

Return ONLY a number between 1-10:`;
}

/**
 * Score context efficiency - how efficiently were tokens/context used?
 */
export function getContextEfficiencyPrompt(
  messages: BaseMessage[],
  toolCalls: ToolExecution[]
): string {
  // Calculate context usage with proper TokenCounter
  const messageCount = messages.length;
  const totalChars = messages.reduce((sum, msg) => {
    const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
    return sum + content.length;
  }, 0);
  
  const estimatedTokens = TokenCounter.countMessages(messages); // Use accurate token counting
  
  // Analyze redundancy
  const toolNames = toolCalls.map(t => t.toolName);
  const duplicateTools = toolNames.length - new Set(toolNames).size;
  const redundancyRate = toolNames.length > 0 ? (duplicateTools / toolNames.length) * 100 : 0;
  
  return `Evaluate how efficiently an AI agent used context and tokens.

## CONTEXT USAGE
- Messages: ${messageCount}
- Total characters: ${totalChars.toLocaleString()}
- Estimated tokens: ${estimatedTokens.toLocaleString()} (accurate with message overhead)
- Tools called: ${toolCalls.length}
- Duplicate tool calls: ${duplicateTools}
- Redundancy rate: ${redundancyRate.toFixed(1)}%

## EFFICIENCY INDICATORS
- Tokens per tool: ${toolCalls.length > 0 ? Math.round(estimatedTokens / toolCalls.length) : 'N/A'}
- Average message length: ${Math.round(totalChars / Math.max(1, messageCount))} chars
- Unique vs total tools: ${new Set(toolNames).size}/${toolNames.length}
- Token estimation method: TokenCounter with overhead

## SCORING INSTRUCTIONS
Rate context efficiency on a 1-10 scale:

10: Extremely concise (<10K tokens)
9: Very efficient (<25K tokens)
8: Efficient (<50K tokens)
7: Good usage (<75K tokens)
6: Acceptable (<100K tokens)
5: Average (<150K tokens)
4: Somewhat wasteful (<200K tokens)
3: Inefficient (<300K tokens)
2: Very wasteful (<500K tokens)
1: Extremely wasteful (>500K tokens)

Consider:
- Token usage vs task complexity
- Redundant operations
- Message verbosity
- Efficient tool usage

Return ONLY a number between 1-10:`;
}

/**
 * Helper function to count consecutive duplicate tool calls
 */
function countConsecutiveDuplicates(toolCalls: ToolExecution[]): number {
  let count = 0;
  for (let i = 1; i < toolCalls.length; i++) {
    if (toolCalls[i].toolName === toolCalls[i-1].toolName) {
      count++;
    }
  }
  return count;
}

/**
 * Helper function to analyze recovery patterns after failures
 */
function analyzeRecoveryPatterns(toolCalls: ToolExecution[]): number {
  let recoveries = 0;
  for (let i = 0; i < toolCalls.length - 1; i++) {
    // If a tool failed and the next tool succeeded, count as recovery
    if (!toolCalls[i].success && toolCalls[i + 1].success) {
      recoveries++;
    }
  }
  return recoveries;
}