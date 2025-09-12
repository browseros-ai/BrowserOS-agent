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
  return `You are a helpful AI assistant that can answer questions about web pages.

## Your Capabilities
- You can analyze and understand web page content
- You can answer questions based on the information provided
- You have access to screenshot_tool for visual information
- You have access to scroll_tool to navigate content

## Important: Browser State
- The current web page content is provided in <browser-state> tags
- Always refer to the content within <browser-state> tags when answering questions about the page
- This browser state is automatically updated when tabs change

## Instructions
1. Be concise and direct in your responses
2. Answer based on the page content within <browser-state> tags
3. Use tools only when necessary for answering the question
4. Focus on providing accurate, helpful answers

You're in Q&A mode. Provide direct answers without planning or task management.`
}

/**
 * Generate page context message to be added as assistant message
 * This contains the actual page content extracted from tabs
 */
export function generatePageContextMessage(pageContext: ExtractedPageContext, isUpdate: boolean = false): string {
  const prefix = isUpdate 
    ? "I've detected that the tabs have changed. Here's the updated page content:"
    : "I've extracted the content from the current page(s). Here's what I found:"

  if (pageContext.isSingleTab) {
    return generateSingleTabContext(pageContext.tabs[0], prefix)
  } else {
    return generateMultiTabContext(pageContext.tabs, prefix)
  }
}

/**
 * Generate context message for single tab
 */
function generateSingleTabContext(tab: ExtractedPageContext['tabs'][0], prefix: string): string {
  return `${prefix}

**Page: ${tab.title}**
URL: ${tab.url}

## Content:
${tab.text}`
}

/**
 * Generate context message for multiple tabs
 */
function generateMultiTabContext(tabs: ExtractedPageContext['tabs'], prefix: string): string {
  const tabSections = tabs.map((tab, index) => `
**Tab ${index + 1}: ${tab.title}**
URL: ${tab.url}

${tab.text}`).join('\n\n---\n')

  return `${prefix}

I'm analyzing ${tabs.length} tabs:

${tabSections}`
}

/**
 * Generate task prompt that wraps the user's query
 * This tells the LLM to refer to the BrowserState content
 */
export function generateTaskPrompt(query: string, contextJustExtracted: boolean): string {
  if (contextJustExtracted) {
    // Context was just extracted and added above
    return `Based on the page content in the <browser-state> tags above, please answer the following question:

"${query}"`
  } else {
    // Context already exists from previous extraction
    return `Using the page content from the <browser-state> tags, please answer:

"${query}"`
  }
}