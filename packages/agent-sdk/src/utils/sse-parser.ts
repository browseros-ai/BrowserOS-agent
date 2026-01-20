import { createParser, type EventSourceMessage } from 'eventsource-parser'
import type { AgentContext } from '../context'
import type {
  ActResult,
  ActStep,
  ToolCall,
  UIMessageStreamEvent,
} from '../types'

export async function parseSSEStream(
  ctx: AgentContext,
  reader: ReadableStreamDefaultReader<Uint8Array>,
  result: ActResult,
): Promise<void> {
  const decoder = new TextDecoder()
  const pendingEvents: UIMessageStreamEvent[] = []

  let currentText = ''
  const currentToolCalls = new Map<string, ToolCall>()

  const parser = createParser({
    onEvent: (msg: EventSourceMessage) => {
      if (msg.data === '[DONE]') return

      try {
        const event = JSON.parse(msg.data) as UIMessageStreamEvent
        pendingEvents.push(event)
      } catch {
        // Invalid JSON, skip
      }
    },
  })

  const processEvent = (event: UIMessageStreamEvent) => {
    ctx.emit(event)

    if (event.type === 'start-step') {
      currentText = ''
      currentToolCalls.clear()
    } else if (event.type === 'text-delta') {
      currentText += event.delta
    } else if (event.type === 'tool-input-available') {
      currentToolCalls.set(event.toolCallId, {
        name: event.toolName,
        args: event.input as Record<string, unknown>,
      })
    } else if (event.type === 'tool-output-available') {
      const tc = currentToolCalls.get(event.toolCallId)
      if (tc) tc.result = event.output
    } else if (event.type === 'finish-step') {
      const step: ActStep = {}
      if (currentText) step.thought = currentText
      if (currentToolCalls.size > 0) {
        step.toolCalls = Array.from(currentToolCalls.values())
      }
      result.steps.push(step)
    } else if (event.type === 'error') {
      result.success = false
    }
  }

  try {
    while (true) {
      ctx.throwIfAborted()

      const { done, value } = await reader.read()
      if (done) break

      const text = decoder.decode(value, { stream: true })
      parser.feed(text)

      let event = pendingEvents.shift()
      while (event) {
        processEvent(event)
        event = pendingEvents.shift()
      }
    }

    let remaining = pendingEvents.shift()
    while (remaining) {
      processEvent(remaining)
      remaining = pendingEvents.shift()
    }
  } finally {
    reader.releaseLock()
  }
}
