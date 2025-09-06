import { BaseMessage, AIMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';
import { ToolExecution } from './EvalScorer.types';
import { TokenCounter } from '@/lib/utils/TokenCounter';

/**
 * Individual scoring prompts for Gemini 2.5 Pro - each dimension scored separately
 * NTN: Focused prompts with only required context for each dimension
 */

/**
 * Helper to wrap any content in XML tags with proper formatting
 */
function wrapInXML(tagName: string, content: string): string {
  return `<${tagName}>
${content}
</${tagName}>`;
}

/**
 * Format message history with XML structure and descriptive title
 */
function formatMessageHistoryXML(messages: BaseMessage[]): string {
  if (!messages || messages.length === 0) {
    return wrapInXML('MessageHistory', 'No messages recorded');
  }
  
  const formattedMessages = messages.map(msg => {
    const role = msg instanceof HumanMessage ? 'Human' : 
                 msg instanceof AIMessage ? 'Assistant' : 
                 msg instanceof SystemMessage ? 'System' : 'Unknown';
    
    const content = typeof msg.content === 'string' ? 
      msg.content : JSON.stringify(msg.content);
    
    // Truncate very long messages
    const truncatedContent = content.length > 500 ? 
      content.substring(0, 500) + '...' : content;
    
    return `${role}: ${truncatedContent}`;
  }).join('\n');
  
  return wrapInXML('MessageHistory', 
    `## Message History from actual run
${formattedMessages}`);
}

/**
 * Format failed tools list with XML structure
 */
function formatFailedToolsXML(failedCalls: ToolExecution[]): string {
  if (!failedCalls || failedCalls.length === 0) {
    return wrapInXML('FailedTools', 'No failed tool executions');
  }
  
  const toolList = failedCalls.map(t => t.toolName).join(', ');
  return wrapInXML('FailedTools', 
    `## Failed Tools from actual run
${toolList}`);
}

/**
 * Format error details with XML structure
 */
function formatErrorDetailsXML(failedCalls: ToolExecution[]): string {
  if (!failedCalls || failedCalls.length === 0) {
    return wrapInXML('ErrorDetails', 'No errors occurred');
  }
  
  const errors = failedCalls.slice(0, 5).map((call, idx) => {
    const errorMsg = call.error || 'Unknown error';
    const duration = call.duration !== undefined ? `${call.duration}ms` : 'N/A';
    return `${idx + 1}. ${call.toolName} (${duration}): ${errorMsg}`;
  }).join('\n');
  
  return wrapInXML('ErrorDetails', 
    `## Error Details from actual run (first 5)
${errors}`);
}

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
  
  // Build prompt with proper structure
  let prompt = `Evaluate if an AI agent completed the user's goal.

`;
  
  // Add user request in XML
  prompt += wrapInXML('UserRequest', 
    `## User Request from actual run
"${query}"`);
  
  prompt += '\n\n';
  
  // Add execution summary in XML
  prompt += wrapInXML('ExecutionSummary',
    `## Execution Summary from actual run
- Total tools executed: ${toolCalls.length}
- Done tool called: ${hasDoneTool ? 'Yes' : 'No'}
- Result/Extract tools used: ${resultTools.length}`);
  
  prompt += '\n\n';
  
  // Add final messages in XML
  prompt += wrapInXML('FinalMessages',
    `## Final Messages from actual run (last 5)
${lastMessages}`);
  
  prompt += '\n\n';
  
  // Add key tool results in XML
  prompt += wrapInXML('KeyToolResults',
    `## Key Tool Results from actual run
${resultTools.map(t => `${t.toolName}: success=${t.success}`).join('\n') || 'No result tools used'}`);
  
  prompt += '\n\n';
  
  // Add scoring instructions
  prompt += `## SCORING INSTRUCTIONS
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
  
  // ALWAYS append message history at the END
  if (messages) {
    prompt += '\n\n' + formatMessageHistoryXML(messages);
  }
  
  return prompt;
}

/**
 * Score plan efficiency - was the execution efficient and well-planned?
 */
export function getPlanEfficiencyPrompt(
  query: string,
  toolCalls: ToolExecution[],
  totalDurationMs: number,
  messages?: BaseMessage[]
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
  
  // Build prompt with proper structure
  let prompt = `Evaluate the efficiency of an AI agent's execution plan.

`;
  
  // Add task in XML
  prompt += wrapInXML('Task',
    `## Task from actual run
"${query}"`);
  
  prompt += '\n\n';
  
  // Add execution metrics in XML
  prompt += wrapInXML('ExecutionMetrics',
    `## Execution Metrics from actual run
- Duration: ${durationSeconds.toFixed(1)} seconds
- Tool calls: ${toolCalls.length}
- Unique tools: ${uniqueTools}
- Consecutive retries: ${retries}
- Used planning: ${hasPlanning ? 'Yes' : 'No'}`);
  
  prompt += '\n\n';
  
  // Add tool sequence in XML
  prompt += wrapInXML('ToolSequence',
    `## Tool Sequence from actual run
${toolSequence || 'No tools executed'}`);
  
  prompt += '\n\n';
  
  // Add scoring instructions
  prompt += `## SCORING INSTRUCTIONS
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
  
  // ALWAYS append message history at the END
  if (messages) {
    prompt += '\n\n' + formatMessageHistoryXML(messages);
  }
  
  return prompt;
}

/**
 * Score error handling - how well were errors managed?
 */
export function getErrorHandlingPrompt(
  toolCalls: ToolExecution[],
  messages?: BaseMessage[]
): string {
  const totalCalls = toolCalls.length;
  const failedCalls = toolCalls.filter(t => !t.success);
  const failureRate = totalCalls > 0 ? (failedCalls.length / totalCalls) * 100 : 0;
  const recoveryAttempts = analyzeRecoveryPatterns(toolCalls);
  
  // Build prompt without message history
  let prompt = `Evaluate how well an AI agent handled errors during execution.

`;
  
  // Add structured statistics
  prompt += wrapInXML('ErrorStatistics', 
    `## Error Statistics from actual run
- Total tool calls: ${totalCalls}
- Failed calls: ${failedCalls.length}
- Failure rate: ${failureRate.toFixed(1)}%
- Recovery attempts: ${recoveryAttempts}`);
  
  prompt += '\n\n';
  
  // Add failed tools list
  prompt += formatFailedToolsXML(failedCalls);
  prompt += '\n\n';
  
  // Add error details
  prompt += formatErrorDetailsXML(failedCalls);
  prompt += '\n\n';
  
  // Add scoring instructions
  prompt += `## SCORING INSTRUCTIONS
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
  
  // ALWAYS append message history at the END
  if (messages) {
    prompt += '\n\n' + formatMessageHistoryXML(messages);
  }
  
  return prompt;
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
  
  // Build prompt with proper formatting
  let prompt = `Evaluate how efficiently an AI agent used context and tokens.

`;
  
  // Add context usage stats in XML
  prompt += wrapInXML('ContextUsage',
    `## Context Usage from actual run
- Messages: ${messageCount}
- Total characters: ${totalChars.toLocaleString()}
- Estimated tokens: ${estimatedTokens.toLocaleString()} (accurate with message overhead)
- Tools called: ${toolCalls.length}
- Duplicate tool calls: ${duplicateTools}
- Redundancy rate: ${redundancyRate.toFixed(1)}%`);
  
  prompt += '\n\n';
  
  // Add efficiency indicators in XML
  prompt += wrapInXML('EfficiencyIndicators',
    `## Efficiency Indicators from actual run
- Tokens per tool: ${toolCalls.length > 0 ? Math.round(estimatedTokens / toolCalls.length) : 'N/A'}
- Average message length: ${Math.round(totalChars / Math.max(1, messageCount))} chars
- Unique vs total tools: ${new Set(toolNames).size}/${toolNames.length}
- Token estimation method: TokenCounter with overhead`);
  
  prompt += '\n\n';
  
  // Add scoring instructions
  prompt += `## SCORING INSTRUCTIONS
Rate context efficiency on a 1-10 scale:

10: Extremely concise (<32K tokens)
9: Very efficient (<64K tokens)
8: Efficient (<100K tokens)
7: Good usage (<128K tokens)
6: Acceptable (<200K tokens)
5: Average (<300K tokens)
4: Somewhat wasteful (<500K tokens)
3: Inefficient (<750K tokens)
2: Very wasteful (<1000K tokens)
1: Extremely wasteful (>1000K tokens)

Consider:
- Token usage vs task complexity
- Redundant operations
- Message verbosity
- Efficient tool usage

Return ONLY a number between 1-10:`;

  // ALWAYS append message history at the END
  if (messages) {
    prompt += '\n\n' + formatMessageHistoryXML(messages);
  }
  
  return prompt;
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
