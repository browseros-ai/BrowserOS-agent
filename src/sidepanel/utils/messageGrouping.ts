import type { Message } from '../stores/chatStore'

export interface MessageGroup {
  type: 'thinking' | 'single'
  messages: Message[]
  isLatest?: boolean
}

/**
 * Simplified grouping for new agent architecture
 * Groups consecutive thinking messages together - no separate planning/execution phases
 * Returns array of MessageGroup objects for clean UI rendering
 */
export function groupMessages(messages: Message[]): MessageGroup[] {
  const groups: MessageGroup[] = []
  let currentThinkingGroup: Message[] = []
  
  const isThinkingContent = (message: Message): boolean => {
    return message.role === 'thinking'
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
      
      // Single message (user, assistant, error, etc.)
      groups.push({
        type: 'single',
        messages: [message],
        isLatest: isLast
      })
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
