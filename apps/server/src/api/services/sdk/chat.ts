/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Chat Service - Executes actions via /chat endpoint
 */

import type { LLMConfig } from '@browseros/shared/schemas/llm'
import { createParser, type EventSourceMessage } from 'eventsource-parser'
import type { UIMessageStreamEvent } from '../../../agent/provider-adapter/ui-message-stream'
import { SdkError } from './types'

export interface ExecuteActionOptions {
  instruction: string
  context?: Record<string, unknown>
  windowId?: number
  llmConfig: LLMConfig
  signal?: AbortSignal
  onSSEEvent?: (event: UIMessageStreamEvent) => Promise<void>
}

export class ChatService {
  private chatUrl: string

  constructor(port: number) {
    this.chatUrl = `http://127.0.0.1:${port}/chat`
  }

  async executeAction(options: ExecuteActionOptions): Promise<void> {
    const { instruction, context, windowId, llmConfig, signal, onSSEEvent } =
      options

    if (signal?.aborted) {
      throw new SdkError('Operation aborted', 400)
    }

    let message = instruction
    if (context) {
      message = `${instruction}\n\nContext:\n${JSON.stringify(context, null, 2)}`
    }

    const conversationId = crypto.randomUUID()

    const response = await fetch(this.chatUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversationId,
        message,
        provider: llmConfig.provider,
        model: llmConfig.model ?? 'default',
        apiKey: llmConfig.apiKey,
        baseUrl: llmConfig.baseUrl,
        resourceName: llmConfig.resourceName,
        region: llmConfig.region,
        accessKeyId: llmConfig.accessKeyId,
        secretAccessKey: llmConfig.secretAccessKey,
        sessionToken: llmConfig.sessionToken,
        browserContext: windowId ? { windowId } : undefined,
      }),
      signal,
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new SdkError(
        errorText || 'Chat request failed',
        response.status >= 400 && response.status < 600 ? response.status : 500,
      )
    }

    const reader = response.body?.getReader()
    if (reader) {
      try {
        if (onSSEEvent) {
          await this.parseAndForwardSSE(reader, signal, onSSEEvent)
        } else {
          await this.drainStream(reader, signal)
        }
      } finally {
        reader.releaseLock()
      }
    }

    // Clean up the session
    await fetch(`${this.chatUrl}/${conversationId}`, {
      method: 'DELETE',
    }).catch(() => {})
  }

  private async parseAndForwardSSE(
    reader: ReadableStreamDefaultReader<Uint8Array>,
    signal: AbortSignal | undefined,
    onSSEEvent: (event: UIMessageStreamEvent) => Promise<void>,
  ): Promise<void> {
    const decoder = new TextDecoder()
    const pendingEvents: UIMessageStreamEvent[] = []

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

    while (true) {
      if (signal?.aborted) {
        await reader.cancel()
        throw new SdkError('Operation aborted', 400)
      }

      const { done, value } = await reader.read()
      if (done) break

      const text = decoder.decode(value, { stream: true })
      parser.feed(text)

      // Process any events that were parsed
      let event = pendingEvents.shift()
      while (event) {
        await onSSEEvent(event)
        event = pendingEvents.shift()
      }
    }

    // Process any remaining events
    let remaining = pendingEvents.shift()
    while (remaining) {
      await onSSEEvent(remaining)
      remaining = pendingEvents.shift()
    }
  }

  private async drainStream(
    reader: ReadableStreamDefaultReader<Uint8Array>,
    signal: AbortSignal | undefined,
  ): Promise<void> {
    while (true) {
      if (signal?.aborted) {
        await reader.cancel()
        throw new SdkError('Operation aborted', 400)
      }
      const { done } = await reader.read()
      if (done) break
    }
  }
}
