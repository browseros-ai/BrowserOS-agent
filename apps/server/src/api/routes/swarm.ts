/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Swarm API Routes
 *
 * HTTP endpoints for creating, monitoring, and controlling swarms.
 * Provides comprehensive API for AI Swarm Mode including:
 * - Swarm creation and execution
 * - Real-time streaming updates
 * - Health and metrics endpoints
 * - Tracing and observability
 */

import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import { z } from 'zod'
import { logger } from '../../lib/logger'
import type { SwarmEvent } from '../../swarm/coordinator/swarm-coordinator'
import type { SwarmService } from '../../swarm/service/swarm-service'
import { SwarmRequestSchema } from '../../swarm/types'

interface SwarmRoutesDeps {
  swarmService: SwarmService
}

/**
 * Extended request schema with priority support.
 */
const ExtendedSwarmRequestSchema = SwarmRequestSchema.extend({
  priority: z
    .enum(['critical', 'high', 'normal', 'low', 'background'])
    .optional(),
})

/**
 * Creates swarm API routes with full SwarmService integration.
 */
export function createSwarmRoutes(deps: SwarmRoutesDeps) {
  const app = new Hono()

  // ============================================================================
  // Core Swarm Endpoints
  // ============================================================================

  /**
   * POST /swarm
   * Create and execute a new swarm
   */
  app.post('/', zValidator('json', ExtendedSwarmRequestSchema), async (c) => {
    const body = c.req.valid('json')
    const outputFormat = (c.req.query('format') ?? 'markdown') as
      | 'json'
      | 'markdown'
      | 'html'
    const stream = c.req.query('stream') === 'true'

    logger.info('Creating swarm via API', {
      task: body.task.slice(0, 100),
      maxWorkers: body.maxWorkers,
      priority: body.priority,
      stream,
    })

    try {
      const result = await deps.swarmService.execute(
        {
          task: body.task,
          maxWorkers: body.maxWorkers,
          timeoutMs: body.timeoutMs,
          outputFormat: body.outputFormat,
          conversationId: body.conversationId,
        },
        {
          priority: body.priority,
          outputFormat,
          stream,
        },
      )

      return c.json({
        success: true,
        data: result,
      })
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Swarm execution failed'

      logger.error('Swarm API error', { error: message })

      return c.json(
        {
          success: false,
          error: message,
        },
        500,
      )
    }
  })

  /**
   * GET /swarm/stream
   * Create and execute a swarm with SSE streaming results (EventSource compatible)
   * Uses query parameters instead of JSON body for browser EventSource compatibility
   */
  app.get('/stream', async (c) => {
    const task = c.req.query('task')
    const maxWorkersParam = c.req.query('maxWorkers')
    const outputFormat = (c.req.query('format') ?? 'markdown') as
      | 'json'
      | 'markdown'
      | 'html'

    if (!task) {
      return c.json(
        { success: false, error: 'task query parameter is required' },
        400,
      )
    }

    const maxWorkers = maxWorkersParam ? parseInt(maxWorkersParam, 10) : 3

    logger.info('Creating streaming swarm (GET)', {
      task: task.slice(0, 100),
      maxWorkers,
    })

    return streamSSE(c, async (stream) => {
      const swarmId = crypto.randomUUID()
      const sendEvent = async (type: string, data: unknown) => {
        await stream.writeSSE({
          event: 'message',
          data: JSON.stringify({
            type,
            swarmId,
            timestamp: Date.now(),
            data,
          }),
        })
      }

      try {
        // Send initial planning status - data is directly the status string
        await sendEvent('status', 'planning')

        // Execute swarm with progress callbacks
        const result = await deps.swarmService.execute(
          { task, maxWorkers, outputFormat },
          {
            outputFormat,
            onStatusChange: async (status: string) => {
              await sendEvent('status', status)
            },
            onWorkerUpdate: async (
              workerId: string,
              update: Record<string, unknown>,
            ) => {
              await sendEvent('worker_update', { id: workerId, ...update })
            },
            onProgress: async (
              progress: number,
              workerProgress?: Record<string, number>,
            ) => {
              await sendEvent('progress', { progress, workerProgress })
            },
          },
        )

        // Send final complete event
        await sendEvent('complete', {
          result: result.result,
          metrics: result.metrics,
        })
      } catch (error) {
        await sendEvent('error', {
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    })
  })

  /**
   * POST /swarm/stream
   * Create and execute a swarm with SSE streaming results
   */
  app.post(
    '/stream',
    zValidator('json', ExtendedSwarmRequestSchema),
    async (c) => {
      const body = c.req.valid('json')
      const outputFormat = (c.req.query('format') ?? 'markdown') as
        | 'json'
        | 'markdown'
        | 'html'

      logger.info('Creating streaming swarm', {
        task: body.task.slice(0, 100),
        maxWorkers: body.maxWorkers,
      })

      return streamSSE(c, async (stream) => {
        try {
          for await (const chunk of deps.swarmService.executeStreaming(
            {
              task: body.task,
              maxWorkers: body.maxWorkers,
              timeoutMs: body.timeoutMs,
              outputFormat: body.outputFormat,
              conversationId: body.conversationId,
            },
            { outputFormat },
          )) {
            await stream.writeSSE({
              event: chunk.type,
              data: JSON.stringify(chunk.data),
            })
          }
        } catch (error) {
          await stream.writeSSE({
            event: 'error',
            data: JSON.stringify({
              error: error instanceof Error ? error.message : 'Unknown error',
            }),
          })
        }
      })
    },
  )

  /**
   * GET /swarm/:swarmId
   * Get swarm status
   */
  app.get('/:swarmId', (c) => {
    const swarmId = c.req.param('swarmId')
    const status = deps.swarmService.getStatus(swarmId)

    if (!status) {
      return c.json(
        {
          success: false,
          error: 'Swarm not found',
        },
        404,
      )
    }

    return c.json({
      success: true,
      data: status,
    })
  })

  /**
   * GET /swarm/:swarmId/stream
   * SSE stream for real-time swarm updates
   */
  app.get('/:swarmId/stream', async (c) => {
    const swarmId = c.req.param('swarmId')
    const status = deps.swarmService.getStatus(swarmId)

    if (!status) {
      return c.json(
        {
          success: false,
          error: 'Swarm not found',
        },
        404,
      )
    }

    return streamSSE(c, async (stream) => {
      // Send initial status
      await stream.writeSSE({
        event: 'status',
        data: JSON.stringify(status),
      })

      // Subscribe to events
      const unsubscribe = deps.swarmService.onEvent((event: SwarmEvent) => {
        if ('swarmId' in event && event.swarmId !== swarmId) return

        stream.writeSSE({
          event: event.type,
          data: JSON.stringify(event),
        })

        // Close stream on terminal events
        if (event.type === 'swarm_completed' || event.type === 'swarm_failed') {
          clearInterval(keepAlive)
          unsubscribe()
          stream.close()
        }
      })

      // Handle client disconnect
      stream.onAbort(() => {
        unsubscribe()
      })

      // Keep alive
      const keepAlive = setInterval(() => {
        stream.writeSSE({
          event: 'ping',
          data: JSON.stringify({ timestamp: Date.now() }),
        })
      }, 30000)

      // Wait for stream to close
      await new Promise<void>((resolve) => {
        stream.onAbort(() => {
          clearInterval(keepAlive)
          unsubscribe()
          resolve()
        })
      })
    })
  })

  /**
   * DELETE /swarm/:swarmId
   * Terminate a running swarm
   */
  app.delete('/:swarmId', async (c) => {
    const swarmId = c.req.param('swarmId')

    try {
      await deps.swarmService.terminate(swarmId)

      return c.json({
        success: true,
        message: 'Swarm terminated',
      })
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to terminate swarm'

      return c.json(
        {
          success: false,
          error: message,
        },
        500,
      )
    }
  })

  // ============================================================================
  // Health & Metrics Endpoints
  // ============================================================================

  /**
   * GET /swarm/health
   * Get swarm service health status
   */
  app.get('/health', async (c) => {
    const health = await deps.swarmService.getHealth()

    const statusCode =
      health.status === 'healthy'
        ? 200
        : health.status === 'degraded'
          ? 200
          : 503

    return c.json(health, statusCode)
  })

  /**
   * GET /swarm/metrics
   * Get swarm service metrics
   */
  app.get('/metrics', (c) => {
    const metrics = deps.swarmService.getMetrics()

    return c.json({
      success: true,
      data: metrics,
    })
  })

  /**
   * GET /swarm/metrics/:swarmId
   * Get metrics for a specific swarm
   */
  app.get('/metrics/:swarmId', (c) => {
    const swarmId = c.req.param('swarmId')
    const metrics = deps.swarmService.getMetrics(swarmId)

    if (!metrics) {
      return c.json(
        {
          success: false,
          error: 'No metrics found for swarm',
        },
        404,
      )
    }

    return c.json({
      success: true,
      data: metrics,
    })
  })

  // ============================================================================
  // Tracing Endpoints
  // ============================================================================

  /**
   * GET /swarm/trace/:traceId
   * Get trace data for debugging
   */
  app.get('/trace/:traceId', (c) => {
    const traceId = c.req.param('traceId')
    const trace = deps.swarmService.getTrace(traceId)

    if (!trace) {
      return c.json(
        {
          success: false,
          error: 'Trace not found',
        },
        404,
      )
    }

    return c.json({
      success: true,
      data: trace,
    })
  })

  return app
}
