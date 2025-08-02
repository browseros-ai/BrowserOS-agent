// Prompt generation functions for SubAgent
// All prompts should be single multi-line strings

export function generateSubAgentSystemPrompt(
  task: string,
  description: string,
  toolDescriptions: string
): string {
  return `Complete this task autonomously: ${task}
${description ? `Context: ${description}` : ''}

IMPORTANT: Be direct and action-focused. Don't explain what you're doing unless there's an error.
CRITICAL: Use todo_manager VERY frequently - mark todos complete immediately after finishing each step. Don't batch completions.

Workflow:
1. Use planner_tool to create 3-5 step plans
2. Add plan steps to todo_manager
3. Execute each TODO step with the appropriate tool
4. Use refresh_browser_state often whenever you think the web page would have changed due to an action we take
5. Mark TODO complete with todo_manager immediately after verification
6. Call done_tool when all TODOs are done and task is verified
7. Use validator_tool to ensure the task has been completed. Don't skip this. If not, go back to step 1.

If something fails:
- take screenshot to get better understanding the visual elements.
- See if there are other approaches.
- Skip the step with todo_manager if truly blocked
- Continue with remaining TODOs with they still make sense if not return failure with reasoning what went wrong.

Success = All TODOs complete + user's goal achieved and verified.

Available tools:
${toolDescriptions}`
}

export function generateSubAgentTaskPrompt(task: string): string {
  return `Execute: ${task}`
}
