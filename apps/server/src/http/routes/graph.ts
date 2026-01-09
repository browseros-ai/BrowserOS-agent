/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { PATHS } from '@browseros/shared/constants/paths'
import { Hono } from 'hono'
import { stream } from 'hono/streaming'
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
import { validateRequest } from '../utils/validation'

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

  // POST /graph - Create new graph
  graph.post('/', validateRequest(CreateGraphRequestSchema), async (c) => {
    const request = c.get('validatedBody') as CreateGraphRequest

    logger.info('Graph create request received', { query: request.query })

    c.header('Content-Type', 'text/event-stream')
    c.header('Cache-Control', 'no-cache')
    c.header('Connection', 'keep-alive')

    const abortController = new AbortController()

    if (c.req.raw.signal) {
      c.req.raw.signal.addEventListener(
        'abort',
        () => abortController.abort(),
        { once: true },
      )
    }

    return stream(c, async (honoStream) => {
      honoStream.onAbort(() => {
        abortController.abort()
        logger.debug('Graph create stream aborted')
      })

      await graphService.createGraph(
        request.query,
        async (event) => {
          await honoStream.write(`data: ${JSON.stringify(event)}\n\n`)
        },
        abortController.signal,
      )

      await honoStream.write('data: [DONE]\n\n')
    })
  })

  // PUT /graph/:id - Update existing graph
  graph.put('/:id', validateRequest(UpdateGraphRequestSchema), async (c) => {
    const sessionId = c.req.param('id')
    const request = c.get('validatedBody') as UpdateGraphRequest

    logger.info('Graph update request received', {
      sessionId,
      query: request.query,
    })

    c.header('Content-Type', 'text/event-stream')
    c.header('Cache-Control', 'no-cache')
    c.header('Connection', 'keep-alive')

    const abortController = new AbortController()

    if (c.req.raw.signal) {
      c.req.raw.signal.addEventListener(
        'abort',
        () => abortController.abort(),
        { once: true },
      )
    }

    return stream(c, async (honoStream) => {
      honoStream.onAbort(() => {
        abortController.abort()
        logger.debug('Graph update stream aborted')
      })

      await graphService.updateGraph(
        sessionId,
        request.query,
        async (event) => {
          await honoStream.write(`data: ${JSON.stringify(event)}\n\n`)
        },
        abortController.signal,
      )

      await honoStream.write('data: [DONE]\n\n')
    })
  })

  // GET /graph/:id - Get graph code and visualization
  graph.get('/:id', async (c) => {
    const sessionId = c.req.param('id')

    logger.debug('Graph get request received', { sessionId })

    const session = await graphService.getGraph(sessionId)

    if (!session) {
      return c.json({ error: 'Graph not found' }, 404)
    }

    return c.json(session)
  })

  // POST /graph/:id/run - Execute graph
  graph.post('/:id/run', validateRequest(RunGraphRequestSchema), async (c) => {
    const sessionId = c.req.param('id')
    const request = c.get('validatedBody') as RunGraphRequest

    logger.info('Graph run request received', {
      sessionId,
      provider: request.provider,
      model: request.model,
    })

    c.header('Content-Type', 'text/event-stream')
    c.header('x-vercel-ai-ui-message-stream', 'v1')
    c.header('Cache-Control', 'no-cache')
    c.header('Connection', 'keep-alive')

    const abortController = new AbortController()

    if (c.req.raw.signal) {
      c.req.raw.signal.addEventListener(
        'abort',
        () => abortController.abort(),
        { once: true },
      )
    }

    return stream(c, async (honoStream) => {
      honoStream.onAbort(() => {
        abortController.abort()
        logger.debug('Graph run stream aborted')
      })

      // Send start event
      await honoStream.write(
        `data: ${JSON.stringify({ type: 'start', messageId: sessionId })}\n\n`,
      )

      await graphService.runGraph(
        sessionId,
        request,
        async (event) => {
          // Map progress events to UI stream format
          if (event.type === 'error') {
            await honoStream.write(
              `data: ${JSON.stringify({ type: 'error', errorText: event.message })}\n\n`,
            )
          } else if (event.type === 'done') {
            await honoStream.write(
              `data: ${JSON.stringify({ type: 'finish', finishReason: 'stop' })}\n\n`,
            )
          } else {
            // nav, act, extract, verify events -> text-delta
            await honoStream.write(
              `data: ${JSON.stringify({ type: 'text-delta', id: '0', delta: `${event.message}\n` })}\n\n`,
            )
          }
        },
        abortController.signal,
      )

      await honoStream.write('data: [DONE]\n\n')
    })
  })

  // DELETE /graph/:id - Cleanup execution files
  graph.delete('/:id', async (c) => {
    const sessionId = c.req.param('id')

    logger.debug('Graph delete request received', { sessionId })

    await graphService.deleteGraph(sessionId)

    return c.json({ success: true, message: `Graph ${sessionId} deleted` })
  })

  return graph
}
