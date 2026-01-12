/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { PATHS } from '@browseros/shared/constants/paths'
import { zValidator } from '@hono/zod-validator'
import type { Context } from 'hono'
import { Hono } from 'hono'
import { stream } from 'hono/streaming'
import {
  formatUIMessageStreamDone,
  formatUIMessageStreamEvent,
  UIMessageStreamWriter,
} from '../../agent/provider-adapter/ui-message-stream'
import { logger } from '../../lib/logger'
import { GraphService } from '../services/graph-service'
import {
  CreateGraphRequestSchema,
  RunGraphRequestSchema,
  UpdateGraphRequestSchema,
} from '../types'
import { SessionIdParamSchema } from '../utils/validation'

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
  codegenServiceUrl?: string
}

export function createGraphRoutes(deps: GraphRouteDeps) {
  const { port, codegenServiceUrl } = deps

  const serverUrl = `http://127.0.0.1:${port}`
  const tempDir = deps.tempDir || PATHS.DEFAULT_TEMP_DIR

  const graphService = codegenServiceUrl
    ? new GraphService({ codegenServiceUrl, serverUrl, tempDir })
    : null

  // Chain route definitions for proper Hono RPC type inference
  return new Hono()
    .post('/', zValidator('json', CreateGraphRequestSchema), async (c) => {
      if (!graphService) {
        return c.json({ error: 'CODEGEN_SERVICE_URL not configured' }, 503)
      }
      const request = c.req.valid('json')
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
    .put(
      '/:id',
      zValidator('param', SessionIdParamSchema),
      zValidator('json', UpdateGraphRequestSchema),
      async (c) => {
        if (!graphService) {
          return c.json({ error: 'CODEGEN_SERVICE_URL not configured' }, 503)
        }
        const { id: sessionId } = c.req.valid('param')
        const request = c.req.valid('json')
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
    .get('/:id', zValidator('param', SessionIdParamSchema), async (c) => {
      if (!graphService) {
        return c.json({ error: 'CODEGEN_SERVICE_URL not configured' }, 503)
      }
      const { id: sessionId } = c.req.valid('param')

      logger.debug('Graph get request received', { sessionId })

      const session = await graphService.getGraph(sessionId)

      if (!session) {
        return c.json({ error: 'Graph not found' }, 404)
      }

      return c.json(session)
    })
    .post(
      '/:id/run',
      zValidator('param', SessionIdParamSchema),
      zValidator('json', RunGraphRequestSchema),
      async (c) => {
        if (!graphService) {
          return c.json({ error: 'CODEGEN_SERVICE_URL not configured' }, 503)
        }
        const { id: sessionId } = c.req.valid('param')
        const request = c.req.valid('json')
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
    .delete('/:id', zValidator('param', SessionIdParamSchema), async (c) => {
      if (!graphService) {
        return c.json({ error: 'CODEGEN_SERVICE_URL not configured' }, 503)
      }
      const { id: sessionId } = c.req.valid('param')

      logger.debug('Graph delete request received', { sessionId })

      await graphService.deleteGraph(sessionId)

      return c.json({ success: true, message: `Graph ${sessionId} deleted` })
    })
}
