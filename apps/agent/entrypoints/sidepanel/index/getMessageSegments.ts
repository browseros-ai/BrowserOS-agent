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

export type NudgeType = 'schedule_suggestion' | 'app_connection'

export interface NudgeData {
  type: NudgeType
  [key: string]: unknown
}

export type MessageSegment =
  | { type: 'text'; key: string; text: string }
  | { type: 'reasoning'; key: string; text: string; isStreaming: boolean }
  | { type: 'tool-batch'; key: string; tools: ToolInvocationInfo[] }
  | { type: 'nudge'; key: string; nudgeType: NudgeType; data: NudgeData }

const NUDGE_TOOLS = new Set(['suggest_schedule', 'suggest_app_connection'])

function parseNudgeOutput(output: unknown): NudgeData | null {
  try {
    // output is { content: [{ type: "text", text: "JSON..." }], isError: false }
    const result = output as {
      content?: Array<{ type: string; text?: string }>
      isError?: boolean
    }
    if (result?.isError) return null

    const text = result?.content?.find((c) => c.type === 'text')?.text
    if (!text) return null

    const parsed = JSON.parse(text)
    if (
      parsed?.type === 'schedule_suggestion' ||
      parsed?.type === 'app_connection'
    ) {
      return parsed as NudgeData
    }
  } catch {
    // ignore parse errors
  }
  return null
}

interface SegmentCache {
  partsLength: number
  segments: MessageSegment[]
  isLastMessage: boolean
  isStreaming: boolean
}

const cache = new Map<string, SegmentCache>()

function computeSegments(
  message: UIMessage,
  isLastMessage: boolean,
  isStreaming: boolean,
): MessageSegment[] {
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
    } else if (part.type?.startsWith('tool-')) {
      const toolPart = part as {
        toolCallId: string
        type: string
        state: ToolInvocationState
        input: Record<string, unknown>
        output: unknown
      }
      const toolName = toolPart.type?.replace('tool-', '')

      if (NUDGE_TOOLS.has(toolName) && toolPart.state === 'output-available') {
        flushToolBatch()
        const nudgeData = parseNudgeOutput(toolPart.output)
        if (nudgeData) {
          segments.push({
            type: 'nudge',
            key: `${message.id}-nudge-${toolPart.toolCallId}`,
            nudgeType: nudgeData.type,
            data: nudgeData,
          })
        }
      } else if (!NUDGE_TOOLS.has(toolName)) {
        currentToolBatch.push({
          state: toolPart.state,
          toolCallId: toolPart.toolCallId,
          toolName,
          input: toolPart?.input ?? {},
          output: (toolPart?.output as unknown[]) ?? [],
        })
      }
    }
  }

  flushToolBatch()

  return segments
}

export const getMessageSegments = (
  message: UIMessage,
  isLastMessage: boolean,
  isStreaming: boolean,
): MessageSegment[] => {
  const cached = cache.get(message.id)

  if (cached && cached.partsLength === message.parts.length) {
    const lastPart = message.parts[message.parts.length - 1]
    const lastSeg = cached.segments[cached.segments.length - 1]

    // Fast path: only last part's text grew (streaming append)
    if (lastSeg?.type === 'reasoning' && lastPart?.type === 'reasoning') {
      if (
        lastSeg.text === lastPart.text &&
        cached.isLastMessage === isLastMessage &&
        cached.isStreaming === isStreaming
      ) {
        return cached.segments
      }
      // Reuse all segments except the last one
      const updated = cached.segments.slice(0, -1)
      updated.push({
        ...lastSeg,
        text: lastPart.text,
        isStreaming: isStreaming && isLastMessage,
      })
      return updated
    }

    if (lastSeg?.type === 'text' && lastPart?.type === 'text') {
      if (lastSeg.text === lastPart.text) {
        return cached.segments
      }
      const updated = cached.segments.slice(0, -1)
      updated.push({ ...lastSeg, text: lastPart.text })
      return updated
    }

    // Structure unchanged and no text change detected
    if (
      cached.isLastMessage === isLastMessage &&
      cached.isStreaming === isStreaming
    ) {
      return cached.segments
    }
  }

  // Full recompute — structure changed (new parts added, etc.)
  const segments = computeSegments(message, isLastMessage, isStreaming)
  cache.set(message.id, {
    partsLength: message.parts.length,
    segments,
    isLastMessage,
    isStreaming,
  })
  return segments
}
