import { zodToJsonSchema } from 'zod-to-json-schema'
import {
  ActionError,
  type AgentSDKError,
  ConnectionError,
  ExtractionError,
  NavigationError,
  VerificationError,
} from './errors.js'
import type {
  ActOptions,
  ActResult,
  AgentOptions,
  ExtractOptions,
  ExtractResult,
  NavOptions,
  NavResult,
  ProgressEvent,
  VerifyOptions,
  VerifyResult,
} from './types.js'

export class Agent {
  private readonly baseUrl: string
  private progressCallback?: (event: ProgressEvent) => void

  constructor(options: AgentOptions) {
    this.baseUrl = options.url.replace(/\/$/, '')
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
      },
      ActionError,
    )

    return result
  }

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
      },
      ExtractionError,
    )

    return result
  }

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
      },
      VerificationError,
    )

    return result
  }
}
