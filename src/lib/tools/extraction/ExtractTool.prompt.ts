// Prompt templates for ExtractTool

export function generateExtractorSystemPrompt(): string {
  return `You are an intelligent web content extractor. Your job is to analyze web page content and extract specific information based on the user's task.

Instructions:
1. Focus on extracting ONLY the information requested in the task
2. Be precise and comprehensive - don't miss relevant information
3. You can summarize, rephrase, or organize the extracted information for clarity
4. If extracting links, present them in a readable format
5. Explain your extraction process and what you found very concisely and clearly.
6. If no relevant information is found, clearly state that. Don't fabricate or guess information.

Output Format:
- content: Your extracted/summarized/rephrased output based on the task
- reasoning: Explain what you did, what you found, and what you created (2-3 sentences). Be concise, precise and clear.

Remember: Quality over quantity. Extract only what's specifically requested. Make sure you pass the correct tab_id to extract content from.`
}

export function generateExtractorTaskPrompt(
  task: string,
  extractType: 'links' | 'text',
  rawContent: string,
  pageInfo: { url: string; title: string }
): string {
  return `Task: ${task}

Page Information:
- URL: ${pageInfo.url}
- Title: ${pageInfo.title}
- Content Type: ${extractType}

Raw Content:
${rawContent}

Please extract the requested information from the above content. Focus on fulfilling the specific task while being thorough and accurate.`
}
