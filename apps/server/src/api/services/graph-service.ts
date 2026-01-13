/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { UIMessageStreamEventSchema } from '@browseros/shared/schemas/ui-stream'
import type { LLMConfig, UIMessageStreamEvent } from '@browseros-ai/agent-sdk'
import { createParser, type EventSourceMessage } from 'eventsource-parser'
import { cleanupExecution, executeGraph } from '../../graph/executor'
import { logger } from '../../lib/logger'
import {
  CodegenFinishMetadataSchema,
  CodegenGetResponseSchema,
  type GraphSession,
  type RunGraphRequest,
  type WorkflowGraph,
} from '../types'

export interface GraphServiceDeps {
  codegenServiceUrl: string
  serverUrl: string
  tempDir: string
}

interface SessionState {
  codeId: string | null
  code: string | null
  graph: WorkflowGraph | null
}

export class GraphService {
  constructor(private deps: GraphServiceDeps) {}

  /**
   * Create a new graph by proxying to codegen service.
   * Streams UIMessageStreamEvent events back to caller.
   */
  async createGraph(
    query: string,
    onEvent: (event: UIMessageStreamEvent) => Promise<void>,
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
    onEvent: (event: UIMessageStreamEvent) => Promise<void>,
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
   * Proxy a request to codegen service and stream UIMessageStreamEvent events.
   */
  private async proxyCodegenRequest(
    url: string,
    method: 'POST' | 'PUT',
    body: { query: string },
    onEvent: (event: UIMessageStreamEvent) => Promise<void>,
    signal?: AbortSignal,
  ): Promise<GraphSession | null> {
    try {
      const response = await this.fetchCodegenService(url, method, body, signal)
      return await this.parseUIMessageStream(response, onEvent)
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      logger.error('Codegen proxy request failed', { url, error: errorMessage })
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

  /**
   * Parse UIMessageStreamEvent SSE stream from codegen service.
   * Extracts codeId, code, graph from the finish event's messageMetadata.
   */
  private async parseUIMessageStream(
    response: Response,
    onEvent: (event: UIMessageStreamEvent) => Promise<void>,
  ): Promise<GraphSession | null> {
    if (!response.body) {
      throw new Error('No response body')
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    const state: SessionState = { codeId: null, code: null, graph: null }
    const pendingEvents: UIMessageStreamEvent[] = []

    const parser = createParser({
      onEvent: (msg: EventSourceMessage) => {
        if (msg.data === '[DONE]') return

        try {
          const json = JSON.parse(msg.data)
          const result = UIMessageStreamEventSchema.safeParse(json)

          if (!result.success) {
            logger.warn('Invalid UIMessageStream event', {
              data: msg.data,
              issues: result.error.issues,
            })
            return
          }

          pendingEvents.push(result.data as UIMessageStreamEvent)
        } catch {
          logger.warn('Failed to parse UIMessageStream event', {
            data: msg.data,
          })
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
          this.extractSessionData(event, state)
          await onEvent(event)
          event = pendingEvents.shift()
        }
      }

      // Process any remaining events
      let remaining = pendingEvents.shift()
      while (remaining) {
        this.extractSessionData(remaining, state)
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

  /**
   * Extract session data (codeId, code, graph) from UIMessageStreamEvent.
   */
  private extractSessionData(
    event: UIMessageStreamEvent,
    state: SessionState,
  ): void {
    if (event.type === 'start' && event.messageId) {
      state.codeId = event.messageId
    } else if (event.type === 'finish' && event.messageMetadata) {
      const result = CodegenFinishMetadataSchema.safeParse(
        event.messageMetadata,
      )
      if (result.success) {
        if (result.data.codeId) state.codeId = result.data.codeId
        if (result.data.code) state.code = result.data.code
        if (result.data.graph !== undefined) state.graph = result.data.graph
      }
    }
  }
}
