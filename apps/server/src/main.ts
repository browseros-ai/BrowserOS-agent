/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * BrowserOS Server Application
 *
 * Manages server lifecycle: initialization, startup, and shutdown.
 */

import type { Database } from 'bun:sqlite'
import fs from 'node:fs'
import path from 'node:path'
import { EXIT_CODES } from '@browseros/shared/constants/exit-codes'
import { TIMEOUTS } from '@browseros/shared/constants/timeouts'
import { createHttpServer } from './api/server'
import { ensureBrowserConnected } from './browser/cdp/connection'
import { McpContext } from './browser/cdp/context'
import { ControllerBridge } from './browser/extension/bridge'
import { ControllerContext } from './browser/extension/context'
import type { ServerConfig } from './config'
import { INLINED_ENV } from './env'
import { initializeDb } from './lib/db'

import { identity } from './lib/identity'
import { logger } from './lib/logger'
import { metrics } from './lib/metrics'
import { MutexPool } from './lib/mutex'
import { isPortInUseError } from './lib/port-binding'
import { fetchDailyRateLimit } from './lib/rate-limiter/fetch-config'
import { RateLimiter } from './lib/rate-limiter/rate-limiter'
import { Sentry } from './lib/sentry'
import { createToolRegistry } from './tools/registry'
import { VERSION } from './version'

export class Application {
  private config: ServerConfig
  private db: Database | null = null

  constructor(config: ServerConfig) {
    this.config = config
  }

  async start(): Promise<void> {
    logger.info(`Starting BrowserOS Server v${VERSION}`)
    logger.debug('Directory config', {
      executionDir: path.resolve(this.config.executionDir),
      resourcesDir: path.resolve(this.config.resourcesDir),
    })

    this.initCoreServices()

    const dailyRateLimit = await fetchDailyRateLimit(identity.getBrowserOSId())

    let controllerContext: ControllerContext
    try {
      const result = await this.createController()
      controllerContext = result.controllerContext
    } catch (error) {
      return this.handleStartupError(
        'WebSocket server',
        this.config.extensionPort,
        error,
      )
    }

    const cdpContext = await this.connectToCdp()

    logger.info(
      `Loaded ${(await import('./tools/controller-based/registry')).allControllerTools.length} controller (extension) tools`,
    )
    const tools = createToolRegistry(cdpContext)
    const mutexPool = new MutexPool()

    try {
      await createHttpServer({
        port: this.config.serverPort,
        host: '0.0.0.0',
        version: VERSION,
        tools,
        cdpContext,
        controllerContext,
        mutexPool,
        allowRemote: this.config.mcpAllowRemote,
        browserosId: identity.getBrowserOSId(),
        executionDir: this.config.executionDir,
        rateLimiter: new RateLimiter(this.getDb(), dailyRateLimit),
        codegenServiceUrl: this.config.codegenServiceUrl,

        onShutdown: () => this.stop(),
      })
    } catch (error) {
      this.handleStartupError('HTTP server', this.config.serverPort, error)
    }

    logger.info(
      `HTTP server listening on http://127.0.0.1:${this.config.serverPort}`,
    )
    logger.info(
      `Health endpoint: http://127.0.0.1:${this.config.serverPort}/health`,
    )

    this.logStartupSummary()

    metrics.log('http_server.started', { version: VERSION })
  }

  stop(): void {
    logger.info('Shutting down server...')

    // Immediate exit without graceful shutdown. Chromium may kill us on update/restart,
    // and we need to free the port instantly so the HTTP port doesn't keep switching.
    process.exit(EXIT_CODES.SUCCESS)
  }

  private initCoreServices(): void {
    this.configureLogDirectory()

    const dbPath = path.join(
      this.config.executionDir || this.config.resourcesDir,
      'browseros.db',
    )
    this.db = initializeDb(dbPath)

    identity.initialize({
      installId: this.config.instanceInstallId,
      db: this.db,
    })

    const browserosId = identity.getBrowserOSId()
    logger.info('BrowserOS ID initialized', {
      browserosId: browserosId.slice(0, 12),
      fromConfig: !!this.config.instanceInstallId,
    })

    metrics.initialize({
      client_id: this.config.instanceClientId,
      install_id: this.config.instanceInstallId,
      browseros_version: this.config.instanceBrowserosVersion,
      chromium_version: this.config.instanceChromiumVersion,
      server_version: VERSION,
    })

    if (!metrics.isEnabled()) {
      logger.warn('Metrics disabled: missing POSTHOG_API_KEY')
    }

    if (!INLINED_ENV.SENTRY_DSN) {
      logger.debug('Sentry disabled: missing SENTRY_DSN')
    }

    Sentry.setContext('browseros', {
      client_id: this.config.instanceClientId,
      install_id: this.config.instanceInstallId,
      browseros_version: this.config.instanceBrowserosVersion,
      chromium_version: this.config.instanceChromiumVersion,
      server_version: VERSION,
    })
  }

  private configureLogDirectory(): void {
    const logDir = this.config.executionDir
    const resolvedDir = path.isAbsolute(logDir)
      ? logDir
      : path.resolve(process.cwd(), logDir)

    try {
      fs.mkdirSync(resolvedDir, { recursive: true })
      logger.setLogFile(resolvedDir)
    } catch (error) {
      console.warn(
        `Failed to configure log directory ${resolvedDir}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      )
    }
  }

  private async createController(): Promise<{
    controllerContext: ControllerContext
  }> {
    const port = this.config.extensionPort
    logger.info(`Controller server starting on ws://127.0.0.1:${port}`)

    const controllerBridge = new ControllerBridge(port, logger)
    await controllerBridge.waitForReady()
    return { controllerContext: new ControllerContext(controllerBridge) }
  }

  private handleStartupError(
    serverName: string,
    port: number,
    error: unknown,
  ): never {
    logger.error(`Failed to start ${serverName}`, {
      port,
      error: error instanceof Error ? error.message : String(error),
    })
    Sentry.captureException(error)

    if (isPortInUseError(error)) {
      logger.error(
        `Port ${port} is already in use. Chromium should try a different port.`,
      )
      process.exit(EXIT_CODES.PORT_CONFLICT)
    }

    process.exit(EXIT_CODES.GENERAL_ERROR)
  }

  private async connectToCdp(): Promise<McpContext | null> {
    if (!this.config.cdpPort) {
      logger.info(
        'CDP disabled (no --cdp-port specified). Only extension tools will be available.',
      )
      return null
    }

    const cdpUrl = `http://127.0.0.1:${this.config.cdpPort}`
    let timeoutId: ReturnType<typeof setTimeout> | undefined

    try {
      const browser = await Promise.race([
        ensureBrowserConnected(cdpUrl),
        new Promise<never>((_, reject) => {
          timeoutId = setTimeout(() => {
            reject(
              new Error(
                `CDP connection timed out after ${TIMEOUTS.CDP_CONNECT}ms`,
              ),
            )
          }, TIMEOUTS.CDP_CONNECT)
        }),
      ])

      logger.info(`Connected to CDP at ${cdpUrl}`)
      const context = await McpContext.from(browser, logger)
      const { allCdpTools } = await import('./tools/cdp-based/registry')
      logger.info(`Loaded ${allCdpTools.length} CDP tools`)
      return context
    } catch (error) {
      logger.warn(`Warning: Could not connect to CDP at ${cdpUrl}`, {
        error: error instanceof Error ? error.message : String(error),
      })
      logger.warn(
        'CDP tools will not be available. Only extension tools will work.',
      )
      return null
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
    }
  }

  private logStartupSummary(): void {
    logger.info('')
    logger.info('Services running:')
    logger.info(
      `  Controller Server: ws://127.0.0.1:${this.config.extensionPort}`,
    )
    logger.info(`  HTTP Server: http://127.0.0.1:${this.config.serverPort}`)
    logger.info('')
  }

  private getDb(): Database {
    if (!this.db) {
      throw new Error(
        'Database not initialized. Call initCoreServices() first.',
      )
    }
    return this.db
  }
}
