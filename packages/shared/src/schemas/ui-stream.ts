/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * UI Message Stream schema (Vercel AI SDK format) - single source of truth.
 * Use z.infer<> for TypeScript types.
 */

import { z } from 'zod'

// Individual event schemas for type annotation
const StartEventSchema = z.object({
  type: z.literal('start'),
  messageId: z.string().optional(),
})
const StartStepEventSchema = z.object({ type: z.literal('start-step') })
const FinishStepEventSchema = z.object({ type: z.literal('finish-step') })
const FinishEventSchema = z.object({
  type: z.literal('finish'),
  finishReason: z.string(),
  messageMetadata: z.unknown().optional(),
})
const AbortEventSchema = z.object({ type: z.literal('abort') })
const ErrorEventSchema = z.object({
  type: z.literal('error'),
  errorText: z.string(),
})
const TextStartEventSchema = z.object({
  type: z.literal('text-start'),
  id: z.string(),
})
const TextDeltaEventSchema = z.object({
  type: z.literal('text-delta'),
  id: z.string(),
  delta: z.string(),
})
const TextEndEventSchema = z.object({
  type: z.literal('text-end'),
  id: z.string(),
})
const ReasoningStartEventSchema = z.object({
  type: z.literal('reasoning-start'),
  id: z.string(),
})
const ReasoningDeltaEventSchema = z.object({
  type: z.literal('reasoning-delta'),
  id: z.string(),
  delta: z.string(),
})
const ReasoningEndEventSchema = z.object({
  type: z.literal('reasoning-end'),
  id: z.string(),
})
const ToolInputStartEventSchema = z.object({
  type: z.literal('tool-input-start'),
  toolCallId: z.string(),
  toolName: z.string(),
})
const ToolInputDeltaEventSchema = z.object({
  type: z.literal('tool-input-delta'),
  toolCallId: z.string(),
  inputTextDelta: z.string(),
})
const ToolInputAvailableEventSchema = z.object({
  type: z.literal('tool-input-available'),
  toolCallId: z.string(),
  toolName: z.string(),
  input: z.unknown(),
})
const ToolInputErrorEventSchema = z.object({
  type: z.literal('tool-input-error'),
  toolCallId: z.string(),
  errorText: z.string(),
})
const ToolOutputAvailableEventSchema = z.object({
  type: z.literal('tool-output-available'),
  toolCallId: z.string(),
  output: z.unknown(),
})
const ToolOutputErrorEventSchema = z.object({
  type: z.literal('tool-output-error'),
  toolCallId: z.string(),
  errorText: z.string(),
})
const SourceUrlEventSchema = z.object({
  type: z.literal('source-url'),
  sourceId: z.string(),
  url: z.string(),
  title: z.string().optional(),
})
const FileEventSchema = z.object({
  type: z.literal('file'),
  url: z.string(),
  mediaType: z.string(),
})

/**
 * Zod schema for UIMessageStreamEvent validation.
 * The type is derived from this schema - single source of truth.
 */
export const UIMessageStreamEventSchema: z.ZodDiscriminatedUnion<
  'type',
  [
    typeof StartEventSchema,
    typeof StartStepEventSchema,
    typeof FinishStepEventSchema,
    typeof FinishEventSchema,
    typeof AbortEventSchema,
    typeof ErrorEventSchema,
    typeof TextStartEventSchema,
    typeof TextDeltaEventSchema,
    typeof TextEndEventSchema,
    typeof ReasoningStartEventSchema,
    typeof ReasoningDeltaEventSchema,
    typeof ReasoningEndEventSchema,
    typeof ToolInputStartEventSchema,
    typeof ToolInputDeltaEventSchema,
    typeof ToolInputAvailableEventSchema,
    typeof ToolInputErrorEventSchema,
    typeof ToolOutputAvailableEventSchema,
    typeof ToolOutputErrorEventSchema,
    typeof SourceUrlEventSchema,
    typeof FileEventSchema,
  ]
> = z.discriminatedUnion('type', [
  StartEventSchema,
  StartStepEventSchema,
  FinishStepEventSchema,
  FinishEventSchema,
  AbortEventSchema,
  ErrorEventSchema,
  TextStartEventSchema,
  TextDeltaEventSchema,
  TextEndEventSchema,
  ReasoningStartEventSchema,
  ReasoningDeltaEventSchema,
  ReasoningEndEventSchema,
  ToolInputStartEventSchema,
  ToolInputDeltaEventSchema,
  ToolInputAvailableEventSchema,
  ToolInputErrorEventSchema,
  ToolOutputAvailableEventSchema,
  ToolOutputErrorEventSchema,
  SourceUrlEventSchema,
  FileEventSchema,
])

/**
 * UI Message Stream events (Vercel AI SDK format).
 * Derived from UIMessageStreamEventSchema.
 */
export type UIMessageStreamEvent = z.infer<typeof UIMessageStreamEventSchema>
