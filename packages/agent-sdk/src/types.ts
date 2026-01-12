import type { ZodSchema } from 'zod'

/**
 * Supported LLM providers for browser automation
 */
export type LLMProvider =
  | 'anthropic'
  | 'openai'
  | 'google'
  | 'openrouter'
  | 'azure'
  | 'ollama'
  | 'lmstudio'
  | 'bedrock'
  | 'browseros'
  | 'openai-compatible'

/**
 * LLM configuration for agent operations
 */
export interface LLMConfig {
  provider: LLMProvider
  model?: string
  apiKey?: string
  baseUrl?: string
  resourceName?: string
  region?: string
  accessKeyId?: string
  secretAccessKey?: string
  sessionToken?: string
}

/**
 * Configuration options for creating an Agent instance.
 * @internal Used by runtime - not needed in generated code
 */
export interface AgentOptions {
  url: string
  llm?: LLMConfig
  /** Callback for streaming UI events (Vercel AI SDK format) */
  onProgress?: (event: UIMessageStreamEvent) => void
  signal?: AbortSignal
}

/**
 * Options for the `nav()` method.
 */
export interface NavOptions {
  /** Target a specific tab by ID */
  tabId?: number
  /** Target a specific window by ID */
  windowId?: number
}

/**
 * Options for the `act()` method.
 */
export interface ActOptions {
  /** Key-value pairs to interpolate into the instruction using `{{key}}` syntax */
  context?: Record<string, unknown>
  /** Maximum number of steps for multi-step actions (default: 10) */
  maxSteps?: number
  /** Target a specific window by ID */
  windowId?: number
}

/**
 * Options for the `extract()` method.
 */
export interface ExtractOptions<T> {
  /** Zod schema defining the expected data structure */
  schema: ZodSchema<T>
  /** Optional key-value pairs for additional context */
  context?: Record<string, unknown>
}

/**
 * Options for the `verify()` method.
 */
export interface VerifyOptions {
  /** Optional key-value pairs for additional context */
  context?: Record<string, unknown>
}

/**
 * Types of progress events emitted by agent methods.
 */
export type ProgressEventType =
  | 'nav'
  | 'act'
  | 'extract'
  | 'verify'
  | 'error'
  | 'done'

/**
 * Progress event emitted during agent operations.
 */
export interface ProgressEvent {
  /** The type of operation */
  type: ProgressEventType
  /** Human-readable description of the current operation */
  message: string
  /** Additional metadata about the operation */
  metadata?: Record<string, unknown>
}

/**
 * UI Message Stream events (Vercel AI SDK format).
 * These events are forwarded from the /chat endpoint during act() calls.
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

/**
 * Result returned by `nav()`.
 */
export interface NavResult {
  /** Whether navigation succeeded */
  success: boolean
}

/**
 * Result returned by `act()`.
 */
export interface ActResult {
  /** Whether the action succeeded */
  success: boolean
  /** The steps executed to complete the action */
  steps: ActStep[]
}

/**
 * A single step executed during an `act()` call.
 */
export interface ActStep {
  /** The agent's reasoning for this step */
  thought?: string
  /** Tool calls made during this step */
  toolCalls?: ToolCall[]
}

/**
 * A tool call made during action execution.
 */
export interface ToolCall {
  /** Name of the tool that was called */
  name: string
  /** Arguments passed to the tool */
  args: Record<string, unknown>
  /** Result returned by the tool */
  result?: unknown
  /** Error message if the tool call failed */
  error?: string
}

/**
 * Result returned by `extract()`.
 */
export interface ExtractResult<T> {
  /** The extracted data matching the provided schema */
  data: T
}

/**
 * Result returned by `verify()`.
 */
export interface VerifyResult {
  /** Whether the verification passed */
  success: boolean
  /** Explanation of why verification passed or failed */
  reason: string
}
