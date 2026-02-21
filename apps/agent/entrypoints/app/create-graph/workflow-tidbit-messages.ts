import type { UIMessage } from 'ai'

type MessagePart = UIMessage['parts'][number]

const TIDBIT_SUFFIXES = ['...', '\u2026'] as const

const isTextPart = (
  part: MessagePart,
): part is MessagePart & { type: 'text' } => part.type === 'text'

const isTidbitLine = (line: string): boolean => {
  const trimmed = line.trim()
  if (trimmed.length === 0) return false
  return TIDBIT_SUFFIXES.some((suffix) => trimmed.endsWith(suffix))
}

export interface WorkflowDisplayState {
  messages: UIMessage[]
  latestTidbit: string | null
}

// strip tidbit lines from a text part, return cleaned text and last tidbit found
const stripTidbitLines = (
  text: string,
): { cleaned: string; lastTidbit: string | null } => {
  const lines = text.split('\n')
  const cleanedLines: string[] = []
  let lastTidbit: string | null = null

  for (const line of lines) {
    if (isTidbitLine(line)) {
      lastTidbit = line.trim()
    } else {
      cleanedLines.push(line)
    }
  }

  return { cleaned: cleanedLines.join('\n'), lastTidbit }
}

// remove tidbit lines from a message's text parts
const stripTidbitsFromMessage = (
  message: UIMessage,
  tidbitState: { lastTidbit: string | null },
): UIMessage | null => {
  if (message.role !== 'assistant') return message

  const newParts: UIMessage['parts'] = []

  for (const part of message.parts) {
    if (!isTextPart(part)) {
      newParts.push(part)
      continue
    }

    const { cleaned, lastTidbit } = stripTidbitLines(part.text)
    if (lastTidbit) tidbitState.lastTidbit = lastTidbit

    // keep the part only if there's non-tidbit content left
    const trimmed = cleaned.trim()
    if (trimmed.length > 0) {
      newParts.push({ ...part, text: trimmed })
    }
  }

  // drop the message entirely if no parts remain
  if (newParts.length === 0) return null

  if (
    newParts.length === message.parts.length &&
    newParts.every((p, i) => p === message.parts[i])
  ) {
    return message
  }

  return { ...message, parts: newParts }
}

/**
 * Process messages for display: strip all tidbit lines from message content
 * and extract the latest tidbit as a separate status string.
 * Tidbits are rendered as a compact status indicator, not as chat content.
 */
export const getWorkflowDisplayState = (
  messages: UIMessage[],
): WorkflowDisplayState => {
  const tidbitState = { lastTidbit: null as string | null }
  const displayMessages: UIMessage[] = []

  for (const message of messages) {
    const stripped = stripTidbitsFromMessage(message, tidbitState)
    if (stripped) displayMessages.push(stripped)
  }

  return {
    messages: displayMessages,
    latestTidbit: tidbitState.lastTidbit,
  }
}
