/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Consolidated HTTP Server
 *
 * This server combines:
 * - Agent HTTP routes (chat, klavis, provider)
 * - MCP HTTP routes (using @hono/mcp transport)
 */

import { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import { HttpAgentError } from '../agent/errors'
import { logger } from '../common/logger'
import { bindPortWithRetry } from '../common/port-binding'
import { createChatRoutes } from './routes/chat'
import { createExtensionStatusRoute } from './routes/extension-status'
import { health } from './routes/health'
import { createKlavisRoutes } from './routes/klavis'
import { createMcpRoutes } from './routes/mcp'
import { createProviderRoutes } from './routes/provider'
import { createSdkRoutes } from './routes/sdk'
import type { Env, HttpServerConfig } from './types'
import { defaultCorsConfig } from './utils/cors'

/**
 * Creates the consolidated HTTP server with port binding retry logic.
 * Retries binding every 5s for up to 30s to handle TIME_WAIT states.
 *
 * @param config - Server configuration
 * @returns Bun server instance
 */
export async function createHttpServer(config: HttpServerConfig) {
  const {
    port,
    host = '0.0.0.0',
    browserosId,
    tempDir,
    rateLimiter,
    version,
    tools,
    cdpContext,
    controllerContext,
    toolMutex,
    allowRemote,
  } = config

  // DECLARATIVE route composition - chain .route() calls for type inference
  const app = new Hono<Env>()
    .use('/*', cors(defaultCorsConfig))
    .route('/health', health)
    .route(
      '/extension-status',
      createExtensionStatusRoute({ controllerContext }),
    )
    .route('/test-provider', createProviderRoutes())
    .route('/klavis', createKlavisRoutes({ browserosId: browserosId || '' }))
    .route(
      '/mcp',
      createMcpRoutes({
        version,
        tools,
        cdpContext,
        controllerContext,
        toolMutex,
        allowRemote,
      }),
    )
    .route(
      '/chat',
      createChatRoutes({
        port,
        tempDir,
        browserosId,
        rateLimiter,
      }),
    )
    .route(
      '/sdk',
      createSdkRoutes({
        port,
        browserosId,
      }),
    )

  // Error handler
  app.onError((err, c) => {
    const error = err as Error

    if (error instanceof HttpAgentError) {
      logger.warn('HTTP Agent Error', {
        name: error.name,
        message: error.message,
        code: error.code,
        statusCode: error.statusCode,
      })
      return c.json(error.toJSON(), error.statusCode as ContentfulStatusCode)
    }

    logger.error('Unhandled Error', {
      message: error.message,
      stack: error.stack,
    })

    return c.json(
      {
        error: {
          name: 'InternalServerError',
          message: error.message || 'An unexpected error occurred',
          code: 'INTERNAL_SERVER_ERROR',
          statusCode: 500,
        },
      },
      500,
    )
  })

  // Bind with retry logic to handle TIME_WAIT states
  const server = await bindPortWithRetry(port, async () => {
    return Bun.serve({
      fetch: (request, server) => app.fetch(request, { server }),
      port,
      hostname: host,
      idleTimeout: 0, // Disable idle timeout for long-running LLM streams
    })
  })

  logger.info('Consolidated HTTP Server started', { port, host })

  return {
    app,
    server,
    config,
  }
}

// Export type for client inference (e.g., hono/client)
export type AppType = Awaited<ReturnType<typeof createHttpServer>>['app']
