import type { UIMessage } from 'ai'

const MAX_MESSAGES = 10
const MAX_MESSAGE_CHARS = 10240

export function formatConversationHistory(messages: UIMessage[]): string {
  if (messages.length === 0) return ''

  const recentMessages = messages.slice(-MAX_MESSAGES)

  const formatted = recentMessages
    .map((msg) => {
      const role = msg.role === 'user' ? 'user' : 'assistant'
      const textContent = msg.parts
        .filter((part) => part.type === 'text')
        .map((part) => part.text)
        .join('\n')

      if (!textContent.trim()) return null

      const truncatedContent =
        textContent.length > MAX_MESSAGE_CHARS
          ? `${textContent.slice(0, MAX_MESSAGE_CHARS)}... [truncated]`
          : textContent

      return `<${role}>${truncatedContent}</${role}>`
    })
    .filter(Boolean)
    .join('\n\n')

  return formatted
}
