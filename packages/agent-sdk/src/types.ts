import type { LLMConfig } from '@browseros/shared/schemas/llm'
import type { ZodSchema } from 'zod'

export type { LLMConfig, LLMProvider } from '@browseros/shared/schemas/llm'

export interface AgentOptions {
  url: string
  llm?: LLMConfig
  onProgress?: (event: ProgressEvent) => void
}

export interface NavOptions {
  tabId?: number
  windowId?: number
}

export interface ActOptions {
  context?: Record<string, unknown>
  maxSteps?: number
  windowId?: number
}

export interface ExtractOptions<T> {
  schema: ZodSchema<T>
  context?: Record<string, unknown>
}

export interface VerifyOptions {
  context?: Record<string, unknown>
}

export type ProgressEventType =
  | 'nav'
  | 'act'
  | 'extract'
  | 'verify'
  | 'error'
  | 'done'

export interface ProgressEvent {
  type: ProgressEventType
  message: string
  metadata?: Record<string, unknown>
}

export interface NavResult {
  success: boolean
}

export interface ActResult {
  success: boolean
  steps: ActStep[]
}

export interface ActStep {
  thought?: string
  toolCalls?: ToolCall[]
}

export interface ToolCall {
  name: string
  args: Record<string, unknown>
  result?: unknown
  error?: string
}

export interface ExtractResult<T> {
  data: T
}

export interface VerifyResult {
  success: boolean
  reason: string
}
