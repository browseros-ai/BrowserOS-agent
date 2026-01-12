/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { PATHS } from '@browseros/shared/constants/paths'
import type { Context } from 'hono'
import { Hono } from 'hono'
import { stream } from 'hono/streaming'
import {
  formatUIMessageStreamDone,
  formatUIMessageStreamEvent,
  UIMessageStreamWriter,
} from '../../agent/agent/gemini-vercel-sdk-adapter/ui-message-stream'
import { logger } from '../../common/logger'
import { GraphService } from '../services/graph-service'
import type {
  CreateGraphRequest,
  RunGraphRequest,
  UpdateGraphRequest,
} from '../types'
import {
  CreateGraphRequestSchema,
  RunGraphRequestSchema,
  UpdateGraphRequestSchema,
} from '../types'
import { validateRequest, validateSessionId } from '../utils/validation'

interface SSEStreamOptions {
  vercelAIStream?: boolean
  logLabel: string
}

type SSEStreamCallback = (
  stream: { write: (data: string) => Promise<unknown> },
  signal: AbortSignal,
) => Promise<void>

function createSSEStream(
  c: Context,
  options: SSEStreamOptions,
  callback: SSEStreamCallback,
) {
  c.header('Content-Type', 'text/event-stream')
  c.header('Cache-Control', 'no-cache')
  c.header('Connection', 'keep-alive')

  if (options.vercelAIStream) {
    c.header('x-vercel-ai-ui-message-stream', 'v1')
  }

  const abortController = new AbortController()

  if (c.req.raw.signal) {
    c.req.raw.signal.addEventListener('abort', () => abortController.abort(), {
      once: true,
    })
  }

  return stream(c, async (honoStream) => {
    honoStream.onAbort(() => {
      abortController.abort()
      logger.debug(`${options.logLabel} stream aborted`)
    })

    await callback(honoStream, abortController.signal)
  })
}

interface GraphRouteDeps {
  port: number
  tempDir?: string
  codegenServiceUrl: string
}

export function createGraphRoutes(deps: GraphRouteDeps) {
  const { port, codegenServiceUrl } = deps

  const serverUrl = `http://127.0.0.1:${port}`
  const tempDir = deps.tempDir || PATHS.DEFAULT_TEMP_DIR

  const graphService = new GraphService({
    codegenServiceUrl,
    serverUrl,
    tempDir,
  })

  const graph = new Hono()

  graph.post('/', validateRequest(CreateGraphRequestSchema), async (c) => {
    const request = c.get('validatedBody') as CreateGraphRequest
    logger.info('Graph create request received', { query: request.query })

    return createSSEStream(
      c,
      { logLabel: 'Graph create' },
      async (s, signal) => {
        await graphService.createGraph(
          request.query,
          async (event) => {
            await s.write(`data: ${JSON.stringify(event)}\n\n`)
          },
          signal,
        )
        await s.write(formatUIMessageStreamDone())
      },
    )
  })

  graph.put(
    '/:id',
    validateSessionId(),
    validateRequest(UpdateGraphRequestSchema),
    async (c) => {
      const sessionId = c.req.param('id')
      const request = c.get('validatedBody') as UpdateGraphRequest
      logger.info('Graph update request received', {
        sessionId,
        query: request.query,
      })

      return createSSEStream(
        c,
        { logLabel: 'Graph update' },
        async (s, signal) => {
          await graphService.updateGraph(
            sessionId,
            request.query,
            async (event) => {
              await s.write(`data: ${JSON.stringify(event)}\n\n`)
            },
            signal,
          )
          await s.write(formatUIMessageStreamDone())
        },
      )
    },
  )

  graph.get('/:id', validateSessionId(), async (c) => {
    const sessionId = c.req.param('id')

    logger.debug('Graph get request received', { sessionId })

    const session = await graphService.getGraph(sessionId)

    if (!session) {
      return c.json({ error: 'Graph not found' }, 404)
    }

    return c.json(session)
  })

  graph.post(
    '/:id/run',
    validateSessionId(),
    validateRequest(RunGraphRequestSchema),
    async (c) => {
      const sessionId = c.req.param('id')
      const request = c.get('validatedBody') as RunGraphRequest
      logger.info('Graph run request received', {
        sessionId,
        provider: request.provider,
        model: request.model,
      })

      return createSSEStream(
        c,
        { logLabel: 'Graph run', vercelAIStream: true },
        async (s, signal) => {
          const writer = new UIMessageStreamWriter(async (data) => {
            await s.write(data)
          })

          try {
            await writer.start(sessionId)

            await graphService.runGraph(
              sessionId,
              request,
              async (event) => {
                // Forward events from agent SDK, skip outer start/finish (we manage those)
                if (event.type === 'start' || event.type === 'finish') return
                await s.write(formatUIMessageStreamEvent(event))
              },
              signal,
            )

            await writer.finish()
          } catch (error) {
            const errorMessage =
              error instanceof Error ? error.message : String(error)
            await writer.writeError(errorMessage)
            await writer.finish('error')
          }
        },
      )
    },
  )

  graph.delete('/:id', validateSessionId(), async (c) => {
    const sessionId = c.req.param('id')

    logger.debug('Graph delete request received', { sessionId })

    await graphService.deleteGraph(sessionId)

    return c.json({ success: true, message: `Graph ${sessionId} deleted` })
  })

  return graph
}
