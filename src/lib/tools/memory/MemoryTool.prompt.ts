/**
 * Memory Tool Prompts
 *
 * These prompts help the agent understand how and when to use the memory system
 * for maintaining context across tasks and sessions.
 */

export const MEMORY_TOOL_EXAMPLES = `
## Memory Tool Usage Examples

### 1. Storing Important Search Results
When you find important information that might be needed later:
\`\`\`
memory_tool({
  action: "add",
  content: "Top songs in January 2025: 1) Flowers by Miley Cyrus, 2) Anti-Hero by Taylor Swift, 3) As It Was by Harry Styles",
  category: "search_result",
  tags: "music,top_songs,2025",
  importance: 0.8
})
\`\`\`

### 2. Remembering User Preferences
When the user expresses preferences:
\`\`\`
memory_tool({
  action: "add", 
  content: "User prefers window seats on flights, no layovers, budget under $500",
  category: "user_preference",
  importance: 0.9
})
\`\`\`

### 3. Storing Task Results for Multi-Step Workflows
After completing a step in a complex task:
\`\`\`
memory_tool({
  action: "store_result",
  content: "Found 3 laptop options: MacBook Air M2 ($1199), Dell XPS 13 ($899), ThinkPad X1 ($1099)",
  taskId: "laptop_research_2025",
  importance: 0.7
})
\`\`\`

### 4. Retrieving Context for Task Continuation
When starting or continuing a task:
\`\`\`
memory_tool({
  action: "search",
  query: "laptop research MacBook Dell ThinkPad",
  category: "search_result",
  limit: 5
})
\`\`\`

### 5. Getting Previous Task Context
When user references previous work:
\`\`\`
memory_tool({
  action: "get_context",
  taskId: "laptop_research_2025"
})
\`\`\`

### 6. Remembering Successful Interaction Patterns
When you successfully complete an action:
\`\`\`
memory_tool({
  action: "add",
  content: "Amazon login: click 'Sign In' button, wait 2 seconds, fill credentials slowly, click 'Sign In' again",
  category: "interaction_pattern",
  tags: "amazon,login",
  importance: 0.8
})
\`\`\`

## When to Use Memory Tool

### Always Use When:
- User asks you to "remember" something
- You find important information that will be needed later
- Completing steps in multi-step tasks
- User mentions preferences or requirements
- You discover successful patterns or solutions

### Consider Using When:
- Navigating between different websites in the same task
- User refers to "what we found earlier"
- Working on research or comparison tasks
- Encountering and solving errors
- Learning user's preferred interaction style

## Memory Categories Guide

- **search_result**: Information found through searches
- **user_preference**: User's stated preferences and requirements  
- **task_result**: Intermediate results from task steps
- **interaction_pattern**: Successful UI interaction sequences
- **workflow_pattern**: Successful task completion patterns
- **error_solution**: Solutions to encountered problems
- **research_data**: Collected research information
- **context_data**: General contextual information

## Best Practices

1. **Be Specific**: Store specific, actionable information rather than vague summaries
2. **Use Appropriate Categories**: Choose the most specific category for better retrieval
3. **Set Importance**: Use 0.8-0.9 for critical info, 0.5-0.7 for useful info, 0.3-0.4 for backup info
4. **Add Relevant Tags**: Include searchable keywords as tags (comma-separated)
5. **Search Before Adding**: Check if similar information already exists
6. **Store Context Early**: Store important findings immediately, don't wait until the end
`;

export const MEMORY_TOOL_SYSTEM_PROMPT = `
You have access to a memory system that allows you to store and retrieve information across tasks and browser sessions. This is crucial for:

1. **Task Continuity**: Remember important findings when navigating between websites
2. **Multi-Step Tasks**: Store intermediate results for complex workflows  
3. **User Preferences**: Remember user's stated preferences and requirements
4. **Pattern Learning**: Store successful interaction patterns for reuse
5. **Error Solutions**: Remember solutions to problems you've encountered

${MEMORY_TOOL_EXAMPLES}

Remember: The memory system enables you to be truly helpful across complex, multi-step tasks by maintaining context and learning from experience.
`;
