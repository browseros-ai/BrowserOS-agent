/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * UI Message Stream schema (Vercel AI SDK format) - single source of truth.
 * Use z.infer<> for TypeScript types.
 */

import { z } from 'zod'

/**
 * Zod schema for UIMessageStreamEvent validation.
 * The type is derived from this schema - single source of truth.
 */
export const UIMessageStreamEventSchema = z.discriminatedUnion('type', [
  // Stream lifecycle
  z.object({ type: z.literal('start'), messageId: z.string().optional() }),
  z.object({ type: z.literal('start-step') }),
  z.object({ type: z.literal('finish-step') }),
  z.object({
    type: z.literal('finish'),
    finishReason: z.string(),
    messageMetadata: z.unknown().optional(),
  }),
  z.object({ type: z.literal('abort') }),
  z.object({ type: z.literal('error'), errorText: z.string() }),

  // Text streaming
  z.object({ type: z.literal('text-start'), id: z.string() }),
  z.object({
    type: z.literal('text-delta'),
    id: z.string(),
    delta: z.string(),
  }),
  z.object({ type: z.literal('text-end'), id: z.string() }),

  // Reasoning streaming
  z.object({ type: z.literal('reasoning-start'), id: z.string() }),
  z.object({
    type: z.literal('reasoning-delta'),
    id: z.string(),
    delta: z.string(),
  }),
  z.object({ type: z.literal('reasoning-end'), id: z.string() }),

  // Tool input streaming
  z.object({
    type: z.literal('tool-input-start'),
    toolCallId: z.string(),
    toolName: z.string(),
  }),
  z.object({
    type: z.literal('tool-input-delta'),
    toolCallId: z.string(),
    inputTextDelta: z.string(),
  }),
  z.object({
    type: z.literal('tool-input-available'),
    toolCallId: z.string(),
    toolName: z.string(),
    input: z.unknown(),
  }),
  z.object({
    type: z.literal('tool-input-error'),
    toolCallId: z.string(),
    errorText: z.string(),
  }),

  // Tool output streaming
  z.object({
    type: z.literal('tool-output-available'),
    toolCallId: z.string(),
    output: z.unknown(),
  }),
  z.object({
    type: z.literal('tool-output-error'),
    toolCallId: z.string(),
    errorText: z.string(),
  }),

  // Sources and files
  z.object({
    type: z.literal('source-url'),
    sourceId: z.string(),
    url: z.string(),
    title: z.string().optional(),
  }),
  z.object({ type: z.literal('file'), url: z.string(), mediaType: z.string() }),
])

/**
 * UI Message Stream events (Vercel AI SDK format).
 * Derived from UIMessageStreamEventSchema.
 */
export type UIMessageStreamEvent = z.infer<typeof UIMessageStreamEventSchema>
