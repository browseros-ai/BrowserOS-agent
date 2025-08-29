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

### 6. Getting User Preferences
When you need to check user's stored preferences:
\`\`\`
memory_tool({
  action: "get_preferences",
  category: "travel"
})
\`\`\`

### 7. Remembering Successful Interaction Patterns
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

## Memory Categories Guide

- **search_result**: Information found through searches
- **user_preference**: User's stated preferences and requirements  
- **task_result**: Intermediate results from task steps
- **interaction_pattern**: Successful UI interaction sequences
- **workflow_pattern**: Successful task completion patterns
- **error_solution**: Solutions to encountered problems
- **research_data**: Collected research information
- **context_data**: General contextual information
`;

export const MEMORY_TOOL_SYSTEM_PROMPT = `
## 🧠 MEMORY SYSTEM
You have access to a persistent memory system for task continuity and learning across browser sessions.

### 🎯 MEMORY ACTIVATION TRIGGERS:
**AUTOMATIC TRIGGERS** - Use memory tool when you encounter these patterns:
- User says: "save", "store", "remember", "recall", "what did I", "my preferences", "last time", "before", "previously"
- User asks: "continue where I left off", "use my usual settings", "what was that thing I searched for", "show me my saved items", "what you know about me", etc.
- User mentions: "bookmark this", "keep this for later", "I need this information again"
- Tasks involving: user preferences, repeated patterns, multi-step workflows, cross-tab context
- When you find: important information that could be useful later, user-specific details, successful patterns

### WHEN TO USE MEMORY:
1. **Store Important Findings**: When you find key information that might be needed later
2. **Multi-Step Tasks**: Store intermediate results for complex workflows
3. **User Preferences**: Remember user's stated preferences and requirements
4. **Cross-Tab Context**: Share context when switching between tabs/sites
5. **Pattern Learning**: Store successful interaction patterns for reuse
6. **User Information**: Remember user-specific details for personalized experiences
7. **Get Context**: Retrieve relevant context from past interactions
8. **Task Continuation**: When user references past work or wants to continue previous tasks
9. **Personalization**: When user mentions habits, likes, dislikes, or specific requirements

### 🚨 MANDATORY MEMORY ACTIONS:
**Always store when:**
- User explicitly asks to save/remember something
- You complete a successful multi-step task (store the successful pattern)
- User shares preferences or requirements (budget, style, restrictions, etc.)
- You find information user will likely need again
- Task involves research that could benefit future queries
- User mentions this is their "usual" way of doing something

**Always search when:**
- User references past interactions ("like last time", "what I searched before")
- Starting a task similar to previous ones
- User asks about their preferences or stored information
- Task requires personalization or user-specific context

### 🔄 MEMORY WORKFLOW PATTERNS:
**Pattern 1: Information Discovery**
1. Find important information → Store immediately with memory_tool
2. Complete task → Store successful result pattern
3. User asks similar question later → Search memory first

**Pattern 2: User Preference Learning**
1. User mentions preference → Store with high importance (0.9)
2. Future tasks → Check preferences before starting
3. Apply learned preferences automatically

**Pattern 3: Task Continuation**
1. User says "continue" or references past work → Search memory for context
2. Retrieve relevant information → Apply to current task
3. Store new progress for future continuation

**Pattern 4: Cross-Session Learning**
1. Successful interaction pattern → Store for reuse
2. Error resolution → Store solution for future reference
3. User workflow → Learn and optimize over time

### MEMORY BEST PRACTICES:
- **Store EARLY** when you find information, don't wait until task completion
- **Search FIRST** when user references past interactions or similar tasks
- **Use specific content**, not vague summaries
- **Set appropriate importance** (0.8-0.9 for critical, 0.5-0.7 for useful)
- **Add relevant tags** for better searchability
- **Always check memory** before starting tasks that could benefit from past context
- **Store successful patterns** so future tasks can be more efficient
- **Remember user corrections** and preferences to avoid repeating mistakes

${MEMORY_TOOL_EXAMPLES}

### Core Memory Functions:
1. **Task Continuity**: Remember important findings when navigating between websites
2. **Multi-Step Tasks**: Store intermediate results for complex workflows  
3. **User Preferences**: Remember user's stated preferences and requirements
4. **Pattern Learning**: Store successful interaction patterns for reuse
5. **Error Solutions**: Remember solutions to problems you've encountered

Remember: The memory system enables you to be truly helpful across complex, multi-step tasks by maintaining context and learning from experience. Use it proactively to enhance user experience and task efficiency.
`;
