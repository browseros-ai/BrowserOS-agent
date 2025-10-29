/**
 * Prompt generation for ChatAgent - minimal and focused for Q&A
 */

interface ExtractedPageContext {
  tabs: Array<{
    id: number
    url: string
    title: string
    text: string
  }>
  isSingleTab: boolean
}

/**
 * Generate simple system prompt that defines the assistant's role
 * This is added ONCE at the beginning of a fresh conversation
 */
export function generateSystemPrompt(): string {
  return `You are a helpful AI assistant for answering questions and providing information.

## Your Capabilities
- Answer questions naturally and conversationally
- Analyze and understand web page content when it's available
- Use screenshot_tool to view visual elements when needed
- Use scroll_tool to navigate through page content when needed

## Operating Modes
You operate in two distinct modes based on whether the user has selected page context:

**Mode 1: Page Context Selected**
- When page content is provided, you must ONLY answer from that content
- If the answer isn't in the provided page(s), politely say the information is not available on this page
- Do NOT use general knowledge when page context is active

**Mode 2: No Page Context (General Mode)**
- When no page content is provided, freely use your general knowledge
- Answer any question to the best of your ability

## General Instructions
1. Be concise and direct in your responses
2. Never mention internal technical details like tags, data structures, or system implementation
3. Use tools only when they would genuinely help answer the question better
4. Speak naturally as if you're having a conversation with a person

You're in Q&A mode. Provide helpful, accurate answers in a natural conversational tone.`
}

/**
 * Generate page context message to be added as assistant message
 * This contains the actual page content extracted from tabs
 */
export function generatePageContextMessage(pageContext: ExtractedPageContext, isUpdate: boolean = false): string {
  // Handle case where user explicitly removed all tabs (no page context)
  // Return empty string - ChatAgent will remove browser state entirely
  if (pageContext.tabs.length === 0) {
    return ''
  }

  // No verbose announcements - just provide the content cleanly
  if (pageContext.isSingleTab) {
    return generateSingleTabContext(pageContext.tabs[0])
  } else {
    return generateMultiTabContext(pageContext.tabs)
  }
}

/**
 * Generate context message for single tab
 */
function generateSingleTabContext(tab: ExtractedPageContext['tabs'][0]): string {
  return `<browser-state>
Page: ${tab.title}
URL: ${tab.url}

${tab.text}
</browser-state>

IMPORTANT: The user has selected this page as context. You must ONLY answer questions based on the content above. If a question cannot be answered using this page's content, politely inform the user that the information is not available on this page. Do not use your general knowledge to answer questions unrelated to this page.`
}

/**
 * Generate context message for multiple tabs
 */
function generateMultiTabContext(tabs: ExtractedPageContext['tabs']): string {
  const tabSections = tabs.map((tab, index) => `
Tab ${index + 1}: ${tab.title}
URL: ${tab.url}

${tab.text}`).join('\n\n---\n')

  return `<browser-state>
${tabSections}
</browser-state>

IMPORTANT: The user has selected these ${tabs.length} pages as context. You must ONLY answer questions based on the content above. If a question cannot be answered using these pages' content, politely inform the user that the information is not available on the selected pages. Do not use your general knowledge to answer questions unrelated to these pages.`
}

/**
 * Generate task prompt for the user's query
 * Simply returns the query without wrapper - the agent naturally uses available context
 */
export function generateTaskPrompt(query: string, contextJustExtracted: boolean): string {
  // Return the query directly without any wrapper
  // The agent will naturally reference browser-state content when relevant
  return query
}