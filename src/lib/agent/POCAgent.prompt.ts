export function generateSystemPrompt(toolDescriptions: string): string {
  return "";
}

export function getReactSystemPrompt(): string {
  return "";
}

export function getPlannerPrompt(): string {
  return `You are a strategic planner for browser automation tasks. 
Generate a natural language plan to complete the given task.
Keep the plan concise and actionable.
Focus on the key steps needed to achieve the goal.`;
}
