/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import type { LLMConfig, UIMessageStreamEvent } from '@browseros-ai/agent-sdk'
import { createParser, type EventSourceMessage } from 'eventsource-parser'
import { cleanupExecution, executeGraph } from '../../graph/executor'
import { logger } from '../../lib/logger'
import {
  CodegenGetResponseSchema,
  type CodegenSSEEvent,
  CodegenSSEEventSchema,
  type GraphSession,
  type RunGraphRequest,
  type WorkflowGraph,
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

      const json = await response.json()
      const result = CodegenGetResponseSchema.safeParse(json)

      if (!result.success) {
        logger.error('Invalid codegen response', {
          issues: result.error.issues,
        })
        throw new Error('Invalid response from codegen service')
      }

      return {
        id: sessionId,
        code: result.data.code,
        graph: result.data.graph,
        createdAt: new Date(result.data.createdAt || Date.now()),
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
    onProgress: (event: UIMessageStreamEvent) => Promise<void>,
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
          provider: request.provider,
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

    const result = await executeGraph(
      graph.code,
      sessionId,
      this.deps.tempDir,
      {
        serverUrl: this.deps.serverUrl,
        llmConfig,
        onProgress: (event) => {
          onProgress(event).catch((err) => {
            logger.warn('Failed to send progress event', { error: String(err) })
          })
        },
        signal,
      },
    )

    if (!result.success) {
      throw new Error(result.error || 'Graph execution failed')
    }
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
    const pendingEvents: CodegenSSEEvent[] = []

    const parser = createParser({
      onEvent: (msg: EventSourceMessage) => {
        if (msg.data === '[DONE]') return

        try {
          const json = JSON.parse(msg.data)
          // Use the event type from SSE `event:` line
          const eventType = msg.event || 'message'

          const event = { event: eventType, data: json } as CodegenSSEEvent
          const result = CodegenSSEEventSchema.safeParse(event)

          if (!result.success) {
            logger.warn('Invalid codegen SSE event', {
              eventType,
              data: msg.data,
              issues: result.error.issues,
            })
            return
          }

          pendingEvents.push(result.data)
        } catch {
          logger.warn('Failed to parse codegen event', { data: msg.data })
        }
      },
    })

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const text = decoder.decode(value, { stream: true })
        parser.feed(text)

        // Process any events that were parsed
        let event = pendingEvents.shift()
        while (event) {
          if (event.event === 'started') {
            state.codeId = event.data.codeId
          } else if (event.event === 'complete') {
            state.codeId = event.data.codeId
            state.code = event.data.code
            state.graph = event.data.graph
          }
          await onEvent(event)
          event = pendingEvents.shift()
        }
      }

      // Process any remaining events
      let remaining = pendingEvents.shift()
      while (remaining) {
        if (remaining.event === 'started') {
          state.codeId = remaining.data.codeId
        } else if (remaining.event === 'complete') {
          state.codeId = remaining.data.codeId
          state.code = remaining.data.code
          state.graph = remaining.data.graph
        }
        await onEvent(remaining)
        remaining = pendingEvents.shift()
      }

      if (state.codeId && state.code) {
        return {
          id: state.codeId,
          code: state.code,
          graph: state.graph,
          createdAt: new Date(),
        }
      }

      return null
    } finally {
      reader.releaseLock()
    }
  }
}
