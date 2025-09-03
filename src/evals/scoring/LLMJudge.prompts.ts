/**
 * Prompts for LLM-based quality scoring
 * Separated for maintainability and easy iteration on scoring criteria
 */

/**
 * Generate prompt for multi-dimensional holistic scoring
 * Evaluates multiple aspects of task execution with enriched metadata
 */
export function getMultiDimensionalScoringPrompt(
  userTask: string,
  enrichedMetadata: any
): string {
  // Extract key metadata for scoring context
  const phase = enrichedMetadata.phase || enrichedMetadata.eventData?.phase || 'unknown'
  const outcome = enrichedMetadata.eventData?.success !== undefined 
    ? (enrichedMetadata.eventData.success ? 'success' : 'failure')
    : phase
  const duration = enrichedMetadata.eventData?.duration_ms || 0
  const planSteps = enrichedMetadata.currentPlan?.steps || []
  const currentStepIndex = enrichedMetadata.currentPlan?.currentStepIndex || 0
  const isReplanning = enrichedMetadata.currentPlan?.isReplanning || false
  const pageTitle = enrichedMetadata.pageTitle || 'N/A'
  const pageUrl = enrichedMetadata.pageUrl || 'N/A'
  const reason = enrichedMetadata.eventData?.reason || enrichedMetadata.reason || 'N/A'
  
  // Extract last message content for context on final state
  const lastMessage = enrichedMetadata.recentMessages?.[enrichedMetadata.recentMessages.length - 1]
  const finalState = lastMessage?.content || 'No final state captured'
  
  // Extract tool execution stats
  const totalToolCalls = enrichedMetadata.totalToolCalls || 0
  const failedToolCalls = enrichedMetadata.failedToolCalls || 0
  const uniqueToolsUsed = enrichedMetadata.uniqueToolsUsed || 0
  
  return `You are evaluating an AI agent's task execution quality across multiple dimensions.

## Task Information
**User's Goal:** ${userTask}
**Current Phase:** ${phase}
**Outcome:** ${outcome}
**Duration:** ${duration}ms
**Reason:** ${reason}

## Execution Statistics
**Total Tool Calls:** ${totalToolCalls}
**Failed Tool Calls:** ${failedToolCalls}
**Unique Tools Used:** ${uniqueToolsUsed}

## Current State
**Page Title:** ${pageTitle}
**Page URL:** ${pageUrl}
**Browser Tabs:** ${enrichedMetadata.browserTabCount || 1}

## Execution Plan
**Total Steps:** ${planSteps.length}
**Current Step:** ${currentStepIndex + 1}/${planSteps.length}
**Is Replanning:** ${isReplanning}
**Plan Steps:**
${planSteps.map((step: string, i: number) => `  ${i + 1}. ${step}${i === currentStepIndex ? ' ← Current' : ''}`).join('\n')}

## Tool Execution History (Complete)
${enrichedMetadata.toolExecutions?.map((exec: any, i: number) => 
  `[${i}] ${exec.name} (${exec.success ? '✓' : '✗'})\n    Args: ${JSON.stringify(exec.args || {}, null, 2)}\n    Result: ${JSON.stringify(exec.result || {}, null, 2)}`
).join('\n') || 'No tool executions'}

## Tool Retry Attempts
${Object.entries(enrichedMetadata.toolRetries || {}).map(([tool, count]) => 
  `- ${tool}: ${count} retries`
).join('\n') || 'No retries detected'}

## Browser Navigation History  
${enrichedMetadata.browserStates?.map((state: any, i: number) => 
  `[${i}] ${state.url} - "${state.title}"`
).join('\n') || 'No browser states captured'}



## Complete TODO Progress
${enrichedMetadata.allTodos?.map((todo: any) => 
  `- [${todo.status}] ${todo.content}`
).join('\n') || 'No TODOs created'}

## Final State
**Last Action:** ${finalState}
**Page Contains Result:** ${pageTitle.toLowerCase().includes('result') || pageTitle.toLowerCase().includes('calculator') ? 'Yes' : 'Unknown'}
**Task Marked Complete:** ${outcome === 'success' ? 'Yes' : 'No'}

## Scoring Instructions
Evaluate the task execution across these dimensions using ALL the context provided above. Each score should be between 0.0 and 1.0.

**IMPORTANT**: Many tools are OPTIONAL and context-dependent. DO NOT penalize the agent for:
- Not using classification_tool if the task was handled directly
- Not using planner_tool for simple, straightforward tasks  
- Not using extract_tool or result_tool if no data extraction was needed
- Not using validator_tool if validation wasn't necessary
- Having 0 values for these metrics when the tools weren't needed

Focus on whether the task was completed successfully and efficiently.

### Dimensions to Score:

1. **goal_achievement** (0-1): How well was the user's goal achieved?
   - Consider: Did the agent complete what the user asked for?
   - Review tool executions and validation results to verify completion
   - IF extract_tool or result_tool were used: Check their outputs to verify information was captured
   - NOTE: These tools are OPTIONAL - not using them is fine if the task didn't require data extraction
   - Review stored data and structured results for evidence of task completion (if applicable)
   - If action was performed (e.g., calculated) but result wasn't reported, score 0.3-0.5 max
   - For paused/error: Consider partial completion based on TODO progress
   - Near-miss scenarios (99% done but missing final step like reporting results): 0.4-0.5

2. **execution_quality** (0-1): Quality of execution steps and decisions
   - Review the tool execution history for logical progression
   - IF classification_tool was used: Check if classification was correct (simple vs complex task)
   - Verify right tools were used at the right times for the specific task
   - For navigation: Did it reach the right page? (check browser history)
   - For forms: Were fields filled correctly? (check interactions)  
   - For information tasks: Was the result properly identified and communicated?
   - Only penalize if important information was visible but not recognized

3. **execution_precision** (0-1): Precision without unnecessary actions
   - Check tool retry attempts and failed tool calls
   - Review interactions for redundant clicks or typing
   - 1.0: No unnecessary retries or redundant actions (0 retries, minimal failed calls)
   - 0.7-0.9: Minor redundancy but mostly efficient (1-2 retries)
   - 0.3-0.6: Multiple unnecessary retries or re-entering data (3-5 retries)
   - 0.0-0.2: Excessive retries, loops, or confusion (>5 retries)

4. **progress_made** (0-1): Amount of progress toward the goal
   - Review TODO completion status and planning history
   - Check how many validations were attempted and their results
   - Consider: How many steps completed? How close to completion?
   - If action was done but final step missed: 0.7-0.8 (high progress, incomplete)
   - For paused: What percentage of work was done?

5. **plan_coherence** (0-1): Quality and logic of the execution plan
   - IF planner_tool was used: Review planning history and how plans evolved
   - IF require_planning_tool was used: Check reasons to understand why re-planning was needed
   - NOTE: Many simple tasks don't need explicit planning - score 1.0 if task was completed efficiently without plans
   - For tasks WITH plans: Check if multiple plans were needed (indicates poor initial planning)
   - Consider: Do the steps make sense? Are they in logical order?
   - PENALIZE: Plans that retry already completed actions
   - Is the approach appropriate for the task (whether planned or direct execution)?

6. **error_handling** (0-1): How well errors/issues were handled
   - Review failed tool calls and how the agent recovered
   - Check validation results to see if errors were properly identified
   - Consider: If errors occurred, were they handled gracefully?
   - PENALIZE: Misdiagnosing success as failure (e.g., retrying when result is visible)
   - For success without errors: score 1.0
   - For paused: Was the pause at a reasonable point?

## Response Format
Return ONLY a JSON object with these exact keys and decimal values:
{
  "goal_achievement": 0.0,
  "execution_quality": 0.0,
  "execution_precision": 0.0,
  "progress_made": 0.0,
  "plan_coherence": 0.0,
  "error_handling": 0.0
}

Remember: Be objective and consider the context. A paused task that made good progress should still get reasonable scores for the progress made.`
}

/**
 * Future: Individual tool scoring
 * 
 * export function getToolScoringPrompt(
 *   userTask: string,
 *   toolName: string,
 *   input: string,
 *   output: string
 * ): string {
 *   // TODO: Implement tool-level scoring prompt
 *   // This will evaluate individual tool execution quality
 *   // considering factors like:
 *   // - Did the tool help achieve the user's goal?
 *   // - Was the tool used correctly?
 *   // - Was the output as expected?
 * }
 */