import type { UIMessage } from 'ai'

type MessagePart = UIMessage['parts'][number]

const TIDBIT_SUFFIXES = ['...', '…'] as const

const isTextPart = (
  part: MessagePart,
): part is MessagePart & { type: 'text' } => part.type === 'text'

const isTidbitText = (text: string): boolean => {
  const trimmedText = text.trim()
  return TIDBIT_SUFFIXES.some((suffix) => trimmedText.endsWith(suffix))
}

const getTextFromMessage = (message: UIMessage): string => {
  return message.parts
    .filter((part) => isTextPart(part))
    .map((part) => part.text)
    .join('')
}

export const isWorkflowTidbitMessage = (message: UIMessage): boolean => {
  if (message.role !== 'assistant') return false
  if (message.parts.length === 0) return false
  if (message.parts.some((part) => !isTextPart(part))) return false

  return getTextFromMessage(message)
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .every((line) => isTidbitText(line))
}

const compactTidbitPartsInMessage = (message: UIMessage): UIMessage => {
  if (message.role !== 'assistant' || message.parts.length < 2) {
    return message
  }

  const compactedParts: UIMessage['parts'] = []
  let pendingTidbitPart: (MessagePart & { type: 'text' }) | null = null

  const flushPendingTidbitPart = () => {
    if (!pendingTidbitPart) return
    compactedParts.push(pendingTidbitPart)
    pendingTidbitPart = null
  }

  for (const part of message.parts) {
    if (isTextPart(part) && isTidbitText(part.text)) {
      pendingTidbitPart = part
      continue
    }

    flushPendingTidbitPart()
    compactedParts.push(part)
  }

  flushPendingTidbitPart()

  if (compactedParts.length === message.parts.length) {
    return message
  }

  return {
    ...message,
    parts: compactedParts,
  }
}

export const getWorkflowDisplayMessages = (
  messages: UIMessage[],
): UIMessage[] => {
  const normalizedMessages = messages.map(compactTidbitPartsInMessage)
  const compactedMessages: UIMessage[] = []

  for (const message of normalizedMessages) {
    const previousMessage = compactedMessages[compactedMessages.length - 1]
    const shouldReplacePreviousTidbit =
      previousMessage &&
      isWorkflowTidbitMessage(previousMessage) &&
      isWorkflowTidbitMessage(message)

    if (shouldReplacePreviousTidbit) {
      compactedMessages[compactedMessages.length - 1] = message
      continue
    }

    compactedMessages.push(message)
  }

  return compactedMessages
}
