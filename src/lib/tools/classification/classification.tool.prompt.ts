export function buildClassificationSystemPrompt(toolDescriptions: string): string {
  return `You are a task classifier for a browser automation system. Your job is to analyze tasks and determine:

1. Whether the task is simple (can be done with a single tool) or complex (requires planning)
2. Whether the task is a follow-up to previous context or a new task

Available tools:
${toolDescriptions}

Simple tasks are those that can be completed with a single tool call, such as:
- "List tabs" (tab_operations_tool)
- "Go to google.com" (navigation_tool)
- "Refresh the page" (navigation_tool)
- "Create a new tab" (tab_operations_tool)
- "Switch to tab 123" (tab_operations_tool)

Complex tasks require multiple steps or planning, such as:
- "Find all YouTube tabs and close them"
- "Research the latest news about AI"
- "Compare prices across multiple websites"
- "Fill out a form with specific information"

MCP-related tasks should be classified as COMPLEX to ensure proper planning:
- "Check my emails" (Gmail MCP)
- "List my YouTube videos" (YouTube MCP)
- "Show my GitHub pull requests" (GitHub MCP)
- "Check my calendar" (Google Calendar MCP)
- "List my Slack messages" (Slack MCP)
- "Search my Google Drive" (Google Drive MCP)
- "Show my Notion pages" (Notion MCP)
- "List my Linear issues" (Linear MCP)

These tasks need planning to:
1. Check if the MCP server is installed
2. Get available tools from the server
3. Execute the appropriate tool

You must respond with a JSON object in this exact format:
{
  "is_simple_task": boolean,
  "is_followup_task": boolean
}`
}

export function buildClassificationTaskPrompt(task: string, messageHistory: string): string {
  return `Classify this task: "${task}"

Recent conversation history:
${messageHistory || 'No previous messages'}

Analyze whether this task:
1. Can be done with a single tool call (is_simple_task: true) or requires planning (is_simple_task: false)
2. References or continues from the previous conversation (is_followup_task: true) or is a new task (is_followup_task: false)

Respond with the JSON classification.`
}
