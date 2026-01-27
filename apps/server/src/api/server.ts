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
 * - Swarm HTTP routes (AI Swarm Mode)
 */

import { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import { HttpAgentError } from '../agent/errors'
import type { ControllerBridge } from '../browser/extension/bridge'
import { logger } from '../lib/logger'
import { bindPortWithRetry } from '../lib/port-binding'
import { SwarmService } from '../swarm/service/swarm-service'
import { createChatRoutes } from './routes/chat'
import { createGraphRoutes } from './routes/graph'
import { createHealthRoute } from './routes/health'
import { createKlavisRoutes } from './routes/klavis'
import { createMcpRoutes } from './routes/mcp'
import { createProviderRoutes } from './routes/provider'
import { createSdkRoutes } from './routes/sdk'
import { createShutdownRoute } from './routes/shutdown'
import { createStatusRoute } from './routes/status'
import { createSwarmRoutes } from './routes/swarm'
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
    executionDir,
    rateLimiter,
    version,
    tools,
    cdpContext,
    controllerContext,
    mutexPool,
    allowRemote,
    swarm: swarmConfig,
  } = config

  const { healthWatchdog, onShutdown } = config

  // Initialize SwarmService if enabled
  let swarmService: SwarmService | null = null
  if (swarmConfig?.enabled) {
    const bridge = controllerContext.bridge
    if (!bridge) {
      logger.warn(
        'SwarmService: Extension bridge not connected, swarm features may be limited',
      )
    }
    swarmService = new SwarmService(
      bridge as ControllerBridge,
      null, // LLM provider will be resolved per-request
      {
        enablePooling: swarmConfig.enablePooling ?? true,
        enableCircuitBreaker: swarmConfig.enableCircuitBreaker ?? true,
        enableTracing: swarmConfig.enableTracing ?? true,
        loadBalancingStrategy:
          swarmConfig.loadBalancingStrategy ?? 'resource-aware',
        maxWorkers: swarmConfig.maxWorkers ?? 10,
      },
    )
    await swarmService.initialize()
    logger.info('SwarmService initialized', { config: swarmConfig })
  }

  // DECLARATIVE route composition - chain .route() calls for type inference
  let app = new Hono<Env>()
    .use('/*', cors(defaultCorsConfig))
    .route('/health', createHealthRoute({ watchdog: healthWatchdog }))
    .route(
      '/shutdown',
      createShutdownRoute({ onShutdown: onShutdown ?? (() => {}) }),
    )
    .route('/status', createStatusRoute({ controllerContext }))
    .route('/test-provider', createProviderRoutes())
    .route('/klavis', createKlavisRoutes({ browserosId: browserosId || '' }))
    .route(
      '/mcp',
      createMcpRoutes({
        version,
        tools,
        cdpContext,
        controllerContext,
        mutexPool,
        allowRemote,
      }),
    )
    .route(
      '/chat',
      createChatRoutes({
        port,
        executionDir,
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
    .route(
      '/graph',
      createGraphRoutes({
        port,
        tempDir: executionDir,
        codegenServiceUrl: config.codegenServiceUrl,
      }),
    )

  // Add swarm routes if SwarmService is enabled
  if (swarmService) {
    app = app.route('/swarm', createSwarmRoutes({ swarmService }))
    logger.info('Swarm routes enabled at /swarm')
  }

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
    swarmService,
    /** Gracefully shutdown all services */
    async shutdown() {
      if (swarmService) {
        await swarmService.shutdown()
        logger.info('SwarmService shutdown complete')
      }
      server.stop()
      logger.info('HTTP Server stopped')
    },
  }
}
