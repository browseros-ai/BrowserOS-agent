import type { UIMessage } from 'ai'

export type ToolInvocationState =
  | 'partial-call'
  | 'call'
  | 'result'
  | 'input-streaming'
  | 'input-available'
  | 'output-available'
  | 'output-error'

export interface ToolInvocationInfo {
  state: ToolInvocationState
  toolCallId: string
  toolName: string
  input: Record<string, unknown>
  output: unknown[]
}

export type MessageSegment =
  | { type: 'text'; key: string; text: string }
  | { type: 'reasoning'; key: string; text: string; isStreaming: boolean }
  | { type: 'tool-batch'; key: string; tools: ToolInvocationInfo[] }

export const getMessageSegments = (
  message: UIMessage,
  isLastMessage: boolean,
  isStreaming: boolean,
): MessageSegment[] => {
  const segments: MessageSegment[] = []
  let currentToolBatch: ToolInvocationInfo[] = []
  let textSegmentCount = 0
  let reasoningSegmentCount = 0

  const flushToolBatch = () => {
    if (currentToolBatch.length > 0) {
      segments.push({
        type: 'tool-batch',
        key: `${message.id}-tools-${currentToolBatch[0].toolCallId}`,
        tools: [...currentToolBatch],
      })
      currentToolBatch = []
    }
  }

  for (let i = 0; i < message.parts.length; i++) {
    const part = message.parts[i]

    if (part.type === 'text') {
      flushToolBatch()
      segments.push({
        type: 'text',
        key: `${message.id}-text-${textSegmentCount}`,
        text: part.text,
      })
      textSegmentCount++
    } else if (part.type === 'reasoning') {
      flushToolBatch()
      segments.push({
        type: 'reasoning',
        key: `${message.id}-reasoning-${reasoningSegmentCount}`,
        text: part.text,
        isStreaming:
          isStreaming && i === message.parts.length - 1 && isLastMessage,
      })
      reasoningSegmentCount++
    } else if (part.type.startsWith('tool-')) {
      const toolPart = part as {
        toolCallId: string
        type: string
        state: ToolInvocationState
        input: Record<string, unknown>
        output: unknown[]
      }
      currentToolBatch.push({
        state: toolPart.state,
        toolCallId: toolPart.toolCallId,
        toolName: toolPart.type?.replace('tool-', ''),
        input: toolPart?.input ?? {},
        output: toolPart?.output ?? [],
      })
    }
  }

  flushToolBatch()

  return segments
}
