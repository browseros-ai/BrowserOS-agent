import type { AgentContext } from './context'
import { act } from './methods/act'
import { extract } from './methods/extract'
import { nav } from './methods/nav'
import { verify } from './methods/verify'
import type {
  ActOptions,
  ActResult,
  AgentOptions,
  BrowserContext,
  ExtractOptions,
  ExtractResult,
  LLMConfig,
  NavOptions,
  NavResult,
  UIMessageStreamEvent,
  VerifyOptions,
  VerifyResult,
} from './types'

/**
 * Browser automation agent for the BrowserOS platform.
 * Provides high-level methods to navigate, interact, extract data, and verify page state.
 *
 * @remarks
 * The Agent instance is injected by the runtime - never instantiate it directly.
 * Export a `run` function that receives the agent as a parameter.
 *
 * @example
 * ```typescript
 * import type { Agent } from '@browseros-ai/agent-sdk'
 * import { z } from 'zod'
 *
 * export async function run(agent: Agent) {
 *   await agent.nav('https://example.com')
 *   await agent.act('click the login button')
 *   const { data } = await agent.extract('get page title', {
 *     schema: z.object({ title: z.string() })
 *   })
 *   return { message: 'Done', data }
 * }
 * ```
 */
export class Agent implements AsyncDisposable, AgentContext {
  readonly baseUrl: string
  readonly llmConfig?: LLMConfig
  readonly signal?: AbortSignal
  readonly browserContext?: BrowserContext
  readonly stateful: boolean

  private progressCallback?: (event: UIMessageStreamEvent) => void
  private _sessionId: string | null = null
  private _disposed = false

  constructor(options: AgentOptions) {
    this.baseUrl = options.url.replace(/\/$/, '')
    this.llmConfig = options.llm
    this.progressCallback = options.onProgress
    this.signal = options.signal
    this.browserContext = options.browserContext
    this.stateful = options.stateful ?? true

    if (this.stateful) {
      this._sessionId = crypto.randomUUID()
    }
  }

  get sessionId(): string | null {
    return this._sessionId
  }

  set sessionId(value: string | null) {
    this._sessionId = value
  }

  async dispose(): Promise<void> {
    if (this._disposed) return
    this._disposed = true

    if (this._sessionId) {
      await fetch(`${this.baseUrl}/chat/${this._sessionId}`, {
        method: 'DELETE',
      }).catch(() => {})
    }
  }

  async [Symbol.asyncDispose](): Promise<void> {
    await this.dispose()
  }

  throwIfAborted(): void {
    if (this.signal?.aborted) {
      throw new Error('Operation aborted')
    }
  }

  onProgress(callback: (event: UIMessageStreamEvent) => void): void {
    this.progressCallback = callback
  }

  emit(event: UIMessageStreamEvent): void {
    this.progressCallback?.(event)
  }

  /**
   * Navigate to a URL and wait for the page to load.
   *
   * @param url - The URL to navigate to (must be a valid HTTP/HTTPS URL)
   * @param options - Optional navigation settings
   * @returns Promise resolving to `{ success: boolean }`
   * @throws {NavigationError} When navigation fails
   *
   * @example
   * ```typescript
   * const { success } = await agent.nav('https://google.com')
   * ```
   */
  nav(url: string, options?: NavOptions): Promise<NavResult> {
    return nav(this, url, options)
  }

  /**
   * Perform a browser action described in natural language.
   *
   * @param instruction - Natural language description of the action
   * @param options - Optional action settings including optional verification
   * @returns Promise resolving to `{ success: boolean, steps: ActStep[] }`
   * @throws {ActionError} When the action fails
   *
   * @example
   * ```typescript
   * // Simple action
   * await agent.act('click the login button')
   *
   * // With verification and retry
   * await agent.act('Click Add to Cart', {
   *   verify: 'Cart shows 1 item',
   *   maxRetries: 2
   * })
   *
   * // With context interpolation
   * await agent.act('search for {{query}}', {
   *   context: { query: 'wireless headphones' }
   * })
   * ```
   */
  act(instruction: string, options?: ActOptions): Promise<ActResult> {
    return act(this, instruction, options)
  }

  /**
   * Extract structured data from the current page using natural language.
   *
   * @param instruction - Natural language description of what data to extract
   * @param options - Extraction options with Zod schema
   * @returns Promise resolving to `{ data: T }`
   * @throws {ExtractionError} When extraction fails
   *
   * @example
   * ```typescript
   * import { z } from 'zod'
   *
   * const { data } = await agent.extract('get product info', {
   *   schema: z.object({
   *     name: z.string(),
   *     price: z.number()
   *   })
   * })
   * ```
   */
  extract<T>(
    instruction: string,
    options: ExtractOptions<T>,
  ): Promise<ExtractResult<T>> {
    return extract(this, instruction, options)
  }

  /**
   * Verify that the current page matches an expected state.
   *
   * @param expectation - Natural language description of expected state
   * @param options - Optional verification settings
   * @returns Promise resolving to `{ success: boolean, reason: string }`
   * @throws {VerificationError} When verification cannot be performed
   *
   * @example
   * ```typescript
   * const { success, reason } = await agent.verify('login form is visible')
   * ```
   */
  verify(expectation: string, options?: VerifyOptions): Promise<VerifyResult> {
    return verify(this, expectation, options)
  }
}
