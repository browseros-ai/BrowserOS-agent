/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Swarm API Routes
 *
 * HTTP endpoints for creating, monitoring, and controlling swarms.
 */

import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { logger } from '../../lib/logger'
import type {
  SwarmCoordinator,
  SwarmEvent,
} from '../../swarm/coordinator/swarm-coordinator'
import { SwarmRequestSchema } from '../../swarm/types'

interface SwarmRoutesDeps {
  coordinator: SwarmCoordinator
}

/**
 * Creates swarm API routes.
 */
export function createSwarmRoutes(deps: SwarmRoutesDeps) {
  const app = new Hono()

  /**
   * POST /swarm
   * Create and execute a new swarm
   */
  app.post(
    '/',
    zValidator('json', SwarmRequestSchema),
    async (c) => {
      const body = c.req.valid('json')
      const outputFormat = (c.req.query('format') ?? 'markdown') as
        | 'json'
        | 'markdown'
        | 'html'

      logger.info('Creating swarm via API', {
        task: body.task.slice(0, 100),
        maxWorkers: body.maxWorkers,
      })

      try {
        const result = await deps.coordinator.createAndExecute(body, {
          outputFormat,
        })

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
    },
  )

  /**
   * POST /swarm/create
   * Create a swarm without executing (for manual control)
   */
  app.post(
    '/create',
    zValidator('json', SwarmRequestSchema),
    async (c) => {
      const body = c.req.valid('json')

      try {
        const swarm = await deps.coordinator.createSwarm(body)

        return c.json({
          success: true,
          data: {
            swarmId: swarm.id,
            state: swarm.state,
            task: swarm.task,
          },
        })
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Failed to create swarm'

        return c.json(
          {
            success: false,
            error: message,
          },
          500,
        )
      }
    },
  )

  /**
   * POST /swarm/:swarmId/execute
   * Execute a previously created swarm
   */
  app.post('/:swarmId/execute', async (c) => {
    const swarmId = c.req.param('swarmId')
    const outputFormat = (c.req.query('format') ?? 'markdown') as
      | 'json'
      | 'markdown'
      | 'html'

    try {
      const result = await deps.coordinator.executeSwarm(swarmId, {
        outputFormat,
      })

      return c.json({
        success: true,
        data: result,
      })
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Swarm execution failed'

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
   * GET /swarm/:swarmId
   * Get swarm status
   */
  app.get('/:swarmId', (c) => {
    const swarmId = c.req.param('swarmId')
    const status = deps.coordinator.getStatus(swarmId)

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
    const status = deps.coordinator.getStatus(swarmId)

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
      const unsubscribe = deps.coordinator.onSwarmEvent((event: SwarmEvent) => {
        if ('swarmId' in event && event.swarmId !== swarmId) return

        stream.writeSSE({
          event: event.type,
          data: JSON.stringify(event),
        })

        // Close stream on terminal events
        if (
          event.type === 'swarm_completed' ||
          event.type === 'swarm_failed'
        ) {
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
      await deps.coordinator.terminateSwarm(swarmId)

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

  return app
}
