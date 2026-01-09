/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import type {
  LLMConfig,
  LLMProvider,
  ProgressEvent,
} from '@browseros-ai/agent-sdk'
import { logger } from '../../common/logger'
import { cleanupExecution, executeGraph } from '../../graph/executor'
import type {
  CodegenSSEEvent,
  GraphSession,
  RunGraphRequest,
  WorkflowGraph,
} from '../types'

export interface GraphServiceDeps {
  codegenServiceUrl: string
  serverUrl: string
  tempDir: string
}

export class GraphService {
  constructor(private deps: GraphServiceDeps) {}

  /**
   * Create a new graph by proxying to codegen service.
   * Streams SSE events back to caller.
   */
  async createGraph(
    query: string,
    onEvent: (event: CodegenSSEEvent) => Promise<void>,
    signal?: AbortSignal,
  ): Promise<GraphSession | null> {
    const url = `${this.deps.codegenServiceUrl}/api/code`

    logger.debug('Creating graph via codegen service', { url, query })

    return this.proxyCodegenRequest(url, 'POST', { query }, onEvent, signal)
  }

  /**
   * Update an existing graph by proxying to codegen service.
   */
  async updateGraph(
    sessionId: string,
    query: string,
    onEvent: (event: CodegenSSEEvent) => Promise<void>,
    signal?: AbortSignal,
  ): Promise<GraphSession | null> {
    const url = `${this.deps.codegenServiceUrl}/api/code/${sessionId}`

    logger.debug('Updating graph via codegen service', {
      url,
      sessionId,
      query,
    })

    return this.proxyCodegenRequest(url, 'PUT', { query }, onEvent, signal)
  }

  /**
   * Get graph code and visualization from codegen service.
   */
  async getGraph(sessionId: string): Promise<GraphSession | null> {
    const url = `${this.deps.codegenServiceUrl}/api/code/${sessionId}`

    logger.debug('Fetching graph from codegen service', { url, sessionId })

    try {
      const response = await fetch(url)

      if (!response.ok) {
        if (response.status === 404) {
          return null
        }
        throw new Error(`Codegen service error: ${response.status}`)
      }

      const data = await response.json()

      return {
        id: sessionId,
        code: data.code,
        graph: data.graph,
        createdAt: new Date(data.createdAt || Date.now()),
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      logger.error('Failed to fetch graph', { sessionId, error: errorMessage })
      throw error
    }
  }

  /**
   * Execute a graph by fetching code from codegen and running it.
   */
  async runGraph(
    sessionId: string,
    request: RunGraphRequest,
    onProgress: (event: ProgressEvent) => Promise<void>,
    signal?: AbortSignal,
  ): Promise<void> {
    // Fetch code from codegen service
    const graph = await this.getGraph(sessionId)

    if (!graph) {
      throw new Error(`Graph not found: ${sessionId}`)
    }

    logger.debug('Executing graph', {
      sessionId,
      codeLength: graph.code.length,
    })

    // Build LLM config from request
    const llmConfig: LLMConfig | undefined = request.provider
      ? {
          provider: request.provider as LLMProvider,
          model: request.model,
          apiKey: request.apiKey,
          baseUrl: request.baseUrl,
          resourceName: request.resourceName,
          region: request.region,
          accessKeyId: request.accessKeyId,
          secretAccessKey: request.secretAccessKey,
          sessionToken: request.sessionToken,
        }
      : undefined

    // Execute the graph
    await executeGraph(graph.code, sessionId, this.deps.tempDir, {
      serverUrl: this.deps.serverUrl,
      llmConfig,
      onProgress: (event) => {
        onProgress(event).catch((err) => {
          logger.warn('Failed to send progress event', { error: String(err) })
        })
      },
      signal,
    })
  }

  /**
   * Delete execution files for a graph.
   */
  async deleteGraph(sessionId: string): Promise<void> {
    await cleanupExecution(sessionId, this.deps.tempDir)
  }

  /**
   * Proxy a request to codegen service and stream SSE events.
   */
  private async proxyCodegenRequest(
    url: string,
    method: 'POST' | 'PUT',
    body: { query: string },
    onEvent: (event: CodegenSSEEvent) => Promise<void>,
    signal?: AbortSignal,
  ): Promise<GraphSession | null> {
    try {
      const response = await this.fetchCodegenService(url, method, body, signal)
      return await this.parseCodegenSSEStream(response, onEvent)
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      logger.error('Codegen proxy request failed', { url, error: errorMessage })

      await onEvent({ event: 'error', data: { error: errorMessage } })
      throw error
    }
  }

  private async fetchCodegenService(
    url: string,
    method: 'POST' | 'PUT',
    body: { query: string },
    signal?: AbortSignal,
  ): Promise<Response> {
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
      },
      body: JSON.stringify(body),
      signal,
    })

    if (!response.ok) {
      throw new Error(`Codegen service error: ${response.status}`)
    }

    if (!response.body) {
      throw new Error('No response body from codegen service')
    }

    return response
  }

  private async parseCodegenSSEStream(
    response: Response,
    onEvent: (event: CodegenSSEEvent) => Promise<void>,
  ): Promise<GraphSession | null> {
    if (!response.body) {
      throw new Error('No response body')
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    const state = {
      codeId: null as string | null,
      code: null as string | null,
      graph: null as WorkflowGraph | null,
    }
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        await this.processSSELine(line, state, onEvent)
      }
    }

    // Process remaining buffer
    await this.processSSELine(buffer, state, onEvent)

    if (state.codeId && state.code) {
      return {
        id: state.codeId,
        code: state.code,
        graph: state.graph,
        createdAt: new Date(),
      }
    }

    return null
  }

  private async processSSELine(
    line: string,
    state: {
      codeId: string | null
      code: string | null
      graph: WorkflowGraph | null
    },
    onEvent: (event: CodegenSSEEvent) => Promise<void>,
  ): Promise<void> {
    if (!line.startsWith('data: ')) return

    const data = line.slice(6).trim()
    if (!data || data === '[DONE]') return

    try {
      const event = JSON.parse(data) as CodegenSSEEvent

      // Capture data from events
      if (event.event === 'started') {
        state.codeId = event.data.codeId
      } else if (event.event === 'complete') {
        state.codeId = event.data.codeId
        state.code = event.data.code
        state.graph = event.data.graph
      }

      await onEvent(event)
    } catch {
      logger.warn('Failed to parse codegen event', { data })
    }
  }
}
