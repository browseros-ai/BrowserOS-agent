/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Chat Service - Executes actions via /chat endpoint
 */

import type { LLMConfig } from '@browseros/shared/schemas/llm'
import { SdkError } from './types'

export interface ExecuteActionOptions {
  instruction: string
  context?: Record<string, unknown>
  windowId?: number
  llmConfig: LLMConfig
}

export class ChatService {
  private chatUrl: string

  constructor(port: number) {
    this.chatUrl = `http://127.0.0.1:${port}/chat`
  }

  async executeAction(options: ExecuteActionOptions): Promise<void> {
    const { instruction, context, windowId, llmConfig } = options

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
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new SdkError(
        errorText || 'Chat request failed',
        response.status >= 400 && response.status < 600 ? response.status : 500,
      )
    }

    // Consume the SSE stream to completion
    const reader = response.body?.getReader()
    if (reader) {
      while (true) {
        const { done } = await reader.read()
        if (done) break
      }
    }

    // Clean up the session
    await fetch(`${this.chatUrl}/${conversationId}`, { method: 'DELETE' })
  }
}
