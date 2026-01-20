import type { BrowserContext, LLMConfig, UIMessageStreamEvent } from './types'

/**
 * Context interface that method modules use to access agent state and utilities.
 * The Agent class implements this interface.
 */
export interface AgentContext {
  readonly baseUrl: string
  readonly llmConfig?: LLMConfig
  readonly browserContext?: BrowserContext
  readonly signal?: AbortSignal
  readonly stateful: boolean

  sessionId: string | null

  emit(event: UIMessageStreamEvent): void
  throwIfAborted(): void
}
