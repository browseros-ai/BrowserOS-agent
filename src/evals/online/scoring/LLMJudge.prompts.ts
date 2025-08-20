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
  
  return `You are evaluating an AI agent's task execution quality across multiple dimensions.

## Task Information
**User's Goal:** ${userTask}
**Current Phase:** ${phase}
**Outcome:** ${outcome}
**Duration:** ${duration}ms
**Reason:** ${reason}

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

## Full Conversation History
${enrichedMetadata.fullConversation?.map((msg: any, i: number) => {
  const type = msg._getType ? msg._getType() : msg.type
  const content = msg.content || ''
  return `[${i}] ${type}: ${content}`
}).join('\n') || 'No conversation history'}

## Complete TODO Progress
${enrichedMetadata.allTodos?.map((todo: any) => 
  `- [${todo.status}] ${todo.content}`
).join('\n') || 'No TODOs created'}

## Final State
**Last Action:** ${finalState}
**Page Contains Result:** ${pageTitle.toLowerCase().includes('result') || pageTitle.toLowerCase().includes('calculator') ? 'Yes' : 'Unknown'}
**Task Marked Complete:** ${outcome === 'success' ? 'Yes' : 'No'}

## Scoring Instructions
Evaluate the task execution across these dimensions. Each score should be between 0.0 and 1.0.

### Dimensions to Score:

1. **goal_achievement** (0-1): How well was the user's goal achieved?
   - Consider: Did the agent complete what the user asked for?
   - CRITICAL: If the task requires getting information, did the agent extract and report it?
   - If action was performed (e.g., calculated) but result wasn't reported, score 0.3-0.5 max
   - For paused/error: Consider partial completion
   - Near-miss scenarios (99% done but missing final step like reporting results): 0.4-0.5

2. **execution_quality** (0-1): Quality of execution steps and decisions
   - Consider: Were the steps logical? Were actions appropriate?
   - For navigation: Did it reach the right page?
   - For forms: Were fields filled correctly?
   - For information tasks: Was the result properly identified and communicated?
   - Penalize if important information was visible but not recognized

3. **execution_precision** (0-1): Precision without unnecessary actions
   - 1.0: No unnecessary retries or redundant actions
   - 0.7-0.9: Minor redundancy but mostly efficient
   - 0.3-0.6: Multiple unnecessary retries or re-entering data
   - 0.0-0.2: Excessive retries, loops, or confusion

4. **progress_made** (0-1): Amount of progress toward the goal
   - Consider: How many steps completed? How close to completion?
   - If action was done but final step missed: 0.7-0.8 (high progress, incomplete)
   - For paused: What percentage of work was done?

5. **plan_coherence** (0-1): Quality and logic of the execution plan
   - Consider: Do the steps make sense? Are they in logical order?
   - PENALIZE: Plans that retry already completed actions
   - Is the plan appropriate for the task?

6. **error_handling** (0-1): How well errors/issues were handled
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