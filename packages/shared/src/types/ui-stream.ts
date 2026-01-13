/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * UI Message Stream types (Vercel AI SDK format).
 * Single source of truth for streaming events.
 */

/**
 * UI Message Stream events (Vercel AI SDK format).
 * These events are used for real-time streaming of AI responses.
 */
export type UIMessageStreamEvent =
  | { type: 'start'; messageId?: string }
  | { type: 'start-step' }
  | { type: 'text-start'; id: string }
  | { type: 'text-delta'; id: string; delta: string }
  | { type: 'text-end'; id: string }
  | { type: 'reasoning-start'; id: string }
  | { type: 'reasoning-delta'; id: string; delta: string }
  | { type: 'reasoning-end'; id: string }
  | { type: 'tool-input-start'; toolCallId: string; toolName: string }
  | { type: 'tool-input-delta'; toolCallId: string; inputTextDelta: string }
  | {
      type: 'tool-input-available'
      toolCallId: string
      toolName: string
      input: unknown
    }
  | { type: 'tool-output-available'; toolCallId: string; output: unknown }
  | { type: 'tool-input-error'; toolCallId: string; errorText: string }
  | { type: 'tool-output-error'; toolCallId: string; errorText: string }
  | { type: 'source-url'; sourceId: string; url: string; title?: string }
  | { type: 'file'; url: string; mediaType: string }
  | { type: 'error'; errorText: string }
  | { type: 'finish-step' }
  | { type: 'finish'; finishReason: string; messageMetadata?: unknown }
  | { type: 'abort' }
