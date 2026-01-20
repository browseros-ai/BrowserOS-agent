import type { BrowserContext } from '@browseros/shared/schemas/browser-context'
import type { LLMConfig, LLMProvider } from '@browseros/shared/schemas/llm'
import type { UIMessageStreamEvent } from '@browseros/shared/schemas/ui-stream'
import type { ZodSchema } from 'zod'

// Re-export shared types for consumers (bundled at build time)
export type { BrowserContext, LLMConfig, LLMProvider, UIMessageStreamEvent }

/**
 * Configuration options for creating an Agent instance.
 * @internal Used by runtime - not needed in generated code
 */
export interface AgentOptions {
  url: string
  llm?: LLMConfig
  /** Browser context for targeting specific windows/tabs and MCP servers */
  browserContext?: BrowserContext
  /** Callback for streaming UI events (Vercel AI SDK format) */
  onProgress?: (event: UIMessageStreamEvent) => void
  signal?: AbortSignal
  /**
   * Enable stateful mode where conversation history persists across act() calls.
   * When true, the agent "remembers" previous interactions.
   * @default true
   */
  stateful?: boolean
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
  /**
   * Reset conversation state for this act() call.
   * Starts fresh and continues with the new state for subsequent calls.
   * @default false
   */
  resetState?: boolean
  /**
   * Condition to verify after action succeeds.
   * If verification fails, the action is retried up to `maxRetries` times.
   * @example 'Cart shows 1 item'
   */
  verify?: string
  /**
   * Maximum retry attempts when verification fails.
   * Only used when `verify` is set.
   * @default 1
   */
  maxRetries?: number
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
