import type { Message } from '../stores/chatStore'

export interface MessageGroup {
  type: 'thinking' | 'execution' | 'single'
  messages: Message[]
  isLatest?: boolean
}

/**
 * Groups consecutive thinking/narration messages together until execution starts
 * Returns array of MessageGroup objects for clean UI rendering
 */
export function groupMessages(messages: Message[]): MessageGroup[] {
  const groups: MessageGroup[] = []
  let currentThinkingGroup: Message[] = []
  
  const isExecutionContent = (message: Message): boolean => {
    const content = message.content.toLowerCase()
    return (
      // Step-like markdown patterns
      /^(\s*-\s*\[\s*[x\s]\s*\]|\s*\d+\.\s+|\s*step\s+\d+)/mi.test(message.content) ||
      // Execution keywords
      content.includes('executing') ||
      content.includes('running') ||
      content.includes('completed step') ||
      content.includes('step completed') ||
      content.includes('execution plan') ||
      content.includes('following steps')
    )
  }
  
  const isThinkingContent = (message: Message): boolean => {
    return (
      message.role === 'thinking' || 
      message.role === 'narration'
    ) && !isExecutionContent(message)
  }
  
  for (let i = 0; i < messages.length; i++) {
    const message = messages[i]
    const isLast = i === messages.length - 1
    
    if (isThinkingContent(message)) {
      // Add to current thinking group
      currentThinkingGroup.push(message)
    } else {
      // Flush current thinking group if it exists
      if (currentThinkingGroup.length > 0) {
        groups.push({
          type: 'thinking',
          messages: [...currentThinkingGroup],
          isLatest: false
        })
        currentThinkingGroup = []
      }
      
      // Handle execution messages
      if (isExecutionContent(message)) {
        groups.push({
          type: 'execution',
          messages: [message],
          isLatest: isLast
        })
      } else {
        // Single message (user, assistant, etc.)
        groups.push({
          type: 'single',
          messages: [message],
          isLatest: isLast
        })
      }
    }
  }
  
  // Flush remaining thinking group
  if (currentThinkingGroup.length > 0) {
    groups.push({
      type: 'thinking',
      messages: [...currentThinkingGroup],
      isLatest: true  // Last group is latest if it's thinking
    })
  }
  
  return groups
}
