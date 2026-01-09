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
import { fetchDailyRateLimit } from './agent/rate-limiter/fetch-config'
import { RateLimiter } from './agent/rate-limiter/rate-limiter'
import { ensureBrowserConnected } from './common/browser'
import { initializeDb } from './common/db'
import { identity } from './common/identity'
import { logger } from './common/logger'
import { McpContext } from './common/mcp-context'
import { metrics } from './common/metrics'
import { Mutex } from './common/mutex'
import { Sentry } from './common/sentry/instrument'
import type { ServerConfig } from './config'
import { ControllerBridge } from './controller-server/controller-bridge'
import { ControllerContext } from './controller-server/controller-context'
import { createHttpServer } from './http/server'
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

    this.initCoreServices()

    const dailyRateLimit = await fetchDailyRateLimit(identity.getBrowserOSId())

    let controllerContext: ControllerContext
    try {
      const result = await this.createController()
      controllerContext = result.controllerContext
    } catch (error) {
      logger.error('Failed to start WebSocket server', {
        port: this.config.extensionPort,
        error: error instanceof Error ? error.message : String(error),
      })
      Sentry.captureException(error)
      process.exit(1)
    }

    const cdpContext = await this.connectToCdp()

    logger.info(
      `Loaded ${(await import('./tools/controller-based/registry')).allControllerTools.length} controller (extension) tools`,
    )
    const tools = createToolRegistry(cdpContext, controllerContext)
    const toolMutex = new Mutex()

    try {
      createHttpServer({
        port: this.config.serverPort,
        host: '0.0.0.0',
        version: VERSION,
        tools,
        cdpContext,
        controllerContext,
        toolMutex,
        allowRemote: this.config.mcpAllowRemote,
        browserosId: identity.getBrowserOSId(),
        tempDir: this.config.executionDir || this.config.resourcesDir,
        rateLimiter: new RateLimiter(this.getDb(), dailyRateLimit),
      })
    } catch (error) {
      logger.error('Failed to start HTTP server', {
        port: this.config.serverPort,
        error: error instanceof Error ? error.message : String(error),
      })
      Sentry.captureException(error)
      process.exit(1)
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
    process.exit(0)
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

    if (!process.env.SENTRY_DSN) {
      logger.warn('Sentry disabled: missing SENTRY_DSN')
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
    logger.info(
      `Controller server starting on ws://127.0.0.1:${this.config.extensionPort}`,
    )
    const controllerBridge = new ControllerBridge(
      this.config.extensionPort,
      logger,
    )
    await controllerBridge.waitForReady()
    return { controllerContext: new ControllerContext(controllerBridge) }
  }

  private async connectToCdp(): Promise<McpContext | null> {
    if (!this.config.cdpPort) {
      logger.info(
        'CDP disabled (no --cdp-port specified). Only extension tools will be available.',
      )
      return null
    }

    try {
      const browser = await ensureBrowserConnected(
        `http://127.0.0.1:${this.config.cdpPort}`,
      )
      logger.info(`Connected to CDP at http://127.0.0.1:${this.config.cdpPort}`)
      const context = await McpContext.from(browser, logger)
      const { allCdpTools } = await import('./tools/cdp-based/registry')
      logger.info(`Loaded ${allCdpTools.length} CDP tools`)
      return context
    } catch (_error) {
      logger.warn(
        `Warning: Could not connect to CDP at http://127.0.0.1:${this.config.cdpPort}`,
      )
      logger.warn(
        'CDP tools will not be available. Only extension tools will work.',
      )
      return null
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
