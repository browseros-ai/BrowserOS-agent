import type { SDKMessage } from '@anthropic-ai/claude-agent-sdk'
import { createUIMessageStream, createUIMessageStreamResponse } from 'ai'
import { logger } from '../lib/logger'

// biome-ignore lint/suspicious/noExplicitAny: SDK event types are complex union types
type Writer = any

function ensureStarted(writer: Writer, messageId: string, started: boolean) {
  if (!started) writer.write({ type: 'start', messageId })
  return true
}

function handleStreamEvent(
  writer: Writer,
  msg: SDKMessage,
): string | undefined {
  // biome-ignore lint/suspicious/noExplicitAny: SDK nested event type
  const event = (msg as any).event
  if (!event) return undefined

  if (event.type === 'content_block_delta') {
    const delta = event.delta
    if (delta?.type === 'text_delta' && delta.text) {
      writer.write({ type: 'text', text: delta.text })
      return delta.text
    }
  } else if (event.type === 'content_block_start') {
    const block = event.content_block
    if (block?.type === 'tool_use') {
      writer.write({
        type: 'tool-call',
        toolCallId: block.id,
        toolName: block.name,
        args: block.input ?? {},
      })
    }
  }
  return undefined
}

function handleAssistantMessage(
  writer: Writer,
  msg: SDKMessage,
): string | undefined {
  // biome-ignore lint/suspicious/noExplicitAny: SDK nested message type
  const message = (msg as any).message
  if (!message?.content) return undefined

  const texts: string[] = []
  for (const block of message.content) {
    if (block.type === 'text' && block.text) {
      writer.write({ type: 'text', text: block.text })
      texts.push(block.text)
    }
    if (block.type === 'tool_use') {
      writer.write({
        type: 'tool-call',
        toolCallId: block.id,
        toolName: block.name,
        args: block.input ?? {},
      })
      writer.write({
        type: 'tool-result',
        toolCallId: block.id,
        result: 'Executed',
      })
    }
  }
  return texts.length > 0 ? texts.join('') : undefined
}

function dispatchMessage(
  writer: Writer,
  msg: SDKMessage,
  textChunks: string[],
): void {
  if (msg.type === 'stream_event') {
    const text = handleStreamEvent(writer, msg)
    if (text) textChunks.push(text)
  } else {
    const text = handleAssistantMessage(writer, msg)
    if (text) textChunks.push(text)
  }
}

async function processStream(
  writer: Writer,
  queryStream: AsyncGenerator<SDKMessage, void>,
  abortSignal: AbortSignal,
  onFinish?: (responseText: string) => Promise<void>,
): Promise<void> {
  const messageId = crypto.randomUUID()
  let started = false
  const textChunks: string[] = []

  try {
    for await (const msg of queryStream) {
      if (abortSignal.aborted) break

      if (msg.type === 'stream_event' || msg.type === 'assistant') {
        started = ensureStarted(writer, messageId, started)
        dispatchMessage(writer, msg, textChunks)
      } else if (msg.type === 'result') {
        started = ensureStarted(writer, messageId, started)
        writer.write({
          type: 'finish',
          finishReason: msg.subtype === 'success' ? 'stop' : 'error',
        })
      } else {
        logger.debug('Unhandled SDK message type', {
          type: msg.type,
          subtype: 'subtype' in msg ? msg.subtype : undefined,
        })
      }
    }

    if (!started) {
      writer.write({ type: 'start', messageId })
      writer.write({ type: 'finish', finishReason: 'stop' })
    }
  } catch (error) {
    logger.error('Claude stream error', {
      error: error instanceof Error ? error.message : String(error),
    })
    ensureStarted(writer, messageId, started)
    writer.write({
      type: 'error',
      errorText: error instanceof Error ? error.message : 'Unknown error',
    })
    writer.write({ type: 'finish', finishReason: 'error' })
  } finally {
    await onFinish?.(textChunks.join(''))
  }
}

export function createClaudeStreamResponse(
  queryStream: AsyncGenerator<SDKMessage, void>,
  abortSignal: AbortSignal,
  onFinish?: (responseText: string) => Promise<void>,
): Response {
  return createUIMessageStreamResponse({
    status: 200,
    stream: createUIMessageStream({
      execute: async ({ writer }) => {
        await processStream(writer, queryStream, abortSignal, onFinish)
      },
    }),
  })
}
