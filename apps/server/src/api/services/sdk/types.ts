/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * SDK Types - Type definitions and request schemas for SDK services
 */

import { LLMConfigSchema } from '@browseros/shared/schemas/llm'
import { z } from 'zod'

// Request validation schemas

export const NavRequestSchema = z.object({
  url: z.string().url(),
  tabId: z.number().optional(),
  windowId: z.number().optional(),
})

export const ActRequestSchema = z.object({
  instruction: z.string().min(1),
  context: z.record(z.unknown()).optional(),
  maxSteps: z.number().optional(),
  windowId: z.number().optional(),
  llm: LLMConfigSchema.optional(),
})

export const ExtractRequestSchema = z.object({
  instruction: z.string().min(1),
  schema: z.record(z.unknown()),
  context: z.record(z.unknown()).optional(),
})

export const VerifyRequestSchema = z.object({
  expectation: z.string().min(1),
  context: z.record(z.unknown()).optional(),
  llm: LLMConfigSchema.optional(),
})

export type NavRequest = z.infer<typeof NavRequestSchema>
export type ActRequest = z.infer<typeof ActRequestSchema>
export type ExtractRequest = z.infer<typeof ExtractRequestSchema>
export type VerifyRequest = z.infer<typeof VerifyRequestSchema>

// Shared types

export interface SdkDeps {
  port: number
  browserosId?: string
}

export interface ActiveTab {
  tabId: number
  url: string
  title: string
  windowId: number
}

export interface PageContent {
  content: string
}

export interface Screenshot {
  data: string
  mimeType: string
}

export class SdkError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
  ) {
    super(message)
    this.name = 'SdkError'
  }
}
