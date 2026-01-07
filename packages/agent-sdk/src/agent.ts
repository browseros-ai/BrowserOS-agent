import { zodToJsonSchema } from 'zod-to-json-schema'
import {
  ActionError,
  type AgentSDKError,
  ConnectionError,
  ExtractionError,
  NavigationError,
  VerificationError,
} from './errors'
import type {
  ActOptions,
  ActResult,
  AgentOptions,
  ExtractOptions,
  ExtractResult,
  LLMConfig,
  NavOptions,
  NavResult,
  ProgressEvent,
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
export class Agent {
  private readonly baseUrl: string
  private readonly llmConfig?: LLMConfig
  private progressCallback?: (event: ProgressEvent) => void

  constructor(options: AgentOptions) {
    this.baseUrl = options.url.replace(/\/$/, '')
    this.llmConfig = options.llm
    this.progressCallback = options.onProgress
  }

  onProgress(callback: (event: ProgressEvent) => void): void {
    this.progressCallback = callback
  }

  private emit(event: ProgressEvent): void {
    this.progressCallback?.(event)
  }

  private async request<T>(
    endpoint: string,
    body: Record<string, unknown>,
    ErrorClass: new (message: string, statusCode?: number) => AgentSDKError,
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`

    let response: Response
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
    } catch (error) {
      throw new ConnectionError(
        `Failed to connect to server: ${error instanceof Error ? error.message : String(error)}`,
        url,
      )
    }

    if (!response.ok) {
      let errorMessage = `Request failed with status ${response.status}`
      try {
        const errorBody = await response.json()
        if (errorBody.error?.message) {
          errorMessage = errorBody.error.message
        }
      } catch {
        // Use default error message
      }
      throw new ErrorClass(errorMessage, response.status)
    }

    return response.json() as Promise<T>
  }

  /**
   * Navigate to a URL and wait for the page to load.
   *
   * @param url - The URL to navigate to (must be a valid HTTP/HTTPS URL)
   * @param options - Optional navigation settings
   * @param options.tabId - Target a specific tab by ID
   * @param options.windowId - Target a specific window by ID
   * @returns Promise resolving to `{ success: boolean }`
   * @throws {NavigationError} When navigation fails
   *
   * @example
   * ```typescript
   * const { success } = await agent.nav('https://google.com')
   * if (!success) {
   *   throw new Error('Navigation failed')
   * }
   * ```
   */
  async nav(url: string, options?: NavOptions): Promise<NavResult> {
    this.emit({
      type: 'nav',
      message: `Navigating to ${url}`,
      metadata: { url },
    })

    const result = await this.request<NavResult>(
      '/sdk/nav',
      { url, ...options },
      NavigationError,
    )

    return result
  }

  /**
   * Perform a browser action described in natural language.
   * The agent interprets the instruction and executes the necessary browser operations.
   *
   * @param instruction - Natural language description of the action to perform. Use `{{key}}` syntax for context variable interpolation.
   * @param options - Optional action settings
   * @param options.context - Key-value pairs to interpolate into the instruction (e.g., `{ query: 'shoes' }` for `'search for {{query}}'`)
   * @param options.maxSteps - Maximum number of steps for multi-step actions (default: 10)
   * @param options.windowId - Target a specific window by ID
   * @returns Promise resolving to `{ success: boolean, steps: ActStep[] }` where steps contains the executed actions
   * @throws {ActionError} When the action fails
   *
   * @example
   * ```typescript
   * // Simple action
   * const { success } = await agent.act('click the login button')
   *
   * // With context interpolation
   * const { success, steps } = await agent.act('search for {{query}}', {
   *   context: { query: 'wireless headphones' }
   * })
   *
   * // Multi-step action with limit
   * await agent.act('fill out the registration form', {
   *   context: { name: 'John', email: 'john@example.com' },
   *   maxSteps: 15
   * })
   * ```
   */
  async act(instruction: string, options?: ActOptions): Promise<ActResult> {
    this.emit({
      type: 'act',
      message: instruction,
      metadata: { instruction },
    })

    const result = await this.request<ActResult>(
      '/sdk/act',
      {
        instruction,
        context: options?.context,
        maxSteps: options?.maxSteps,
        windowId: options?.windowId,
        llm: this.llmConfig,
      },
      ActionError,
    )

    return result
  }

  /**
   * Extract structured data from the current page using natural language.
   * Returns data matching the provided Zod schema.
   *
   * @param instruction - Natural language description of what data to extract
   * @param options - Extraction options (required)
   * @param options.schema - Zod schema defining the expected data structure
   * @param options.context - Optional key-value pairs for additional context
   * @returns Promise resolving to `{ data: T }` where T matches the provided schema
   * @throws {ExtractionError} When extraction fails or data doesn't match schema
   *
   * @example
   * ```typescript
   * import { z } from 'zod'
   *
   * // Extract a single value
   * const { data: title } = await agent.extract('get the page title', {
   *   schema: z.object({ title: z.string() })
   * })
   *
   * // Extract a list of items
   * const { data: products } = await agent.extract('get all product listings', {
   *   schema: z.array(z.object({
   *     name: z.string(),
   *     price: z.number(),
   *     inStock: z.boolean()
   *   }))
   * })
   * ```
   */
  async extract<T>(
    instruction: string,
    options: ExtractOptions<T>,
  ): Promise<ExtractResult<T>> {
    this.emit({
      type: 'extract',
      message: instruction,
      metadata: { instruction },
    })

    const jsonSchema = zodToJsonSchema(options.schema)

    const result = await this.request<ExtractResult<T>>(
      '/sdk/extract',
      {
        instruction,
        schema: jsonSchema,
        context: options.context,
        llm: this.llmConfig,
      },
      ExtractionError,
    )

    return result
  }

  /**
   * Verify that the current page matches an expected state.
   * Use this after actions to confirm they succeeded.
   *
   * @param expectation - Natural language description of the expected page state
   * @param options - Optional verification settings
   * @param options.context - Optional key-value pairs for additional context
   * @returns Promise resolving to `{ success: boolean, reason: string }` where reason explains the verification result
   * @throws {VerificationError} When verification cannot be performed
   *
   * @example
   * ```typescript
   * // Simple verification
   * const { success, reason } = await agent.verify('the login form is visible')
   * if (!success) {
   *   throw new Error(`Verification failed: ${reason}`)
   * }
   *
   * // Verify after an action
   * await agent.act('click the submit button')
   * const { success } = await agent.verify('success message is displayed')
   * ```
   */
  async verify(
    expectation: string,
    options?: VerifyOptions,
  ): Promise<VerifyResult> {
    this.emit({
      type: 'verify',
      message: expectation,
      metadata: { expectation },
    })

    const result = await this.request<VerifyResult>(
      '/sdk/verify',
      {
        expectation,
        context: options?.context,
        llm: this.llmConfig,
      },
      VerificationError,
    )

    return result
  }
}
