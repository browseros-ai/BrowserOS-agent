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

const getNonEmptyLines = (text: string): string[] =>
  text.split('\n').filter((line) => line.trim().length > 0)

const isAllTidbitText = (text: string): boolean => {
  const lines = getNonEmptyLines(text)
  return lines.length > 0 && lines.every((line) => isTidbitLine(line))
}

export const isWorkflowTidbitMessage = (message: UIMessage): boolean => {
  if (message.role !== 'assistant') return false
  if (message.parts.length === 0) return false
  if (message.parts.some((part) => !isTextPart(part))) return false

  const fullText = message.parts
    .filter((part) => isTextPart(part))
    .map((part) => part.text)
    .join('')

  return isAllTidbitText(fullText)
}

// within a text part that has multiple tidbit lines, keep only the last line
const compactTidbitLinesInPart = (part: MessagePart): MessagePart => {
  if (!isTextPart(part)) return part

  const lines = getNonEmptyLines(part.text)
  if (lines.length <= 1) return part
  if (!lines.every((line) => isTidbitLine(line))) return part

  return { ...part, text: lines[lines.length - 1] }
}

// collapse consecutive tidbit text parts within a single message
const compactTidbitPartsInMessage = (message: UIMessage): UIMessage => {
  if (message.role !== 'assistant') return message

  // first compact multi-line tidbit text within each part
  const lineCompactedParts = message.parts.map(compactTidbitLinesInPart)

  // then collapse consecutive tidbit parts to just the last one
  const compactedParts: UIMessage['parts'] = []
  let pendingTidbitPart: (MessagePart & { type: 'text' }) | null = null

  const flushPendingTidbitPart = () => {
    if (!pendingTidbitPart) return
    compactedParts.push(pendingTidbitPart)
    pendingTidbitPart = null
  }

  for (const part of lineCompactedParts) {
    if (isTextPart(part) && isAllTidbitText(part.text)) {
      pendingTidbitPart = part
      continue
    }

    flushPendingTidbitPart()
    compactedParts.push(part)
  }

  flushPendingTidbitPart()

  const partsChanged =
    compactedParts.length !== message.parts.length ||
    compactedParts.some((p, i) => p !== message.parts[i])

  if (!partsChanged) return message

  return { ...message, parts: compactedParts }
}

export const getWorkflowDisplayMessages = (
  messages: UIMessage[],
): UIMessage[] => {
  // first compact tidbit parts within each message
  const normalizedMessages = messages.map(compactTidbitPartsInMessage)
  const compactedMessages: UIMessage[] = []

  // then collapse consecutive tidbit-only messages
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
