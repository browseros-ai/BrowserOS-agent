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

import { RateLimiter } from './agent/index.js'
import { fetchDailyRateLimit } from './agent/rate-limiter/fetch-config.js'
import {
  ensureBrowserConnected,
  identity,
  initializeDb,
  logger,
  McpContext,
  Mutex,
  metrics,
} from './common/index.js'
import { Sentry } from './common/sentry/instrument.js'
import type { ServerConfig } from './config.js'
import {
  ControllerBridge,
  ControllerContext,
} from './controller-server/index.js'
import { createHttpServer } from './http/index.js'
import { createToolRegistry } from './tools/registry.js'
import { VERSION } from './version.js'

export class Application {
  private config: ServerConfig
  private controllerBridge: ControllerBridge | null = null
  private httpServer: ReturnType<typeof createHttpServer> | null = null
  private db: Database | null = null

  constructor(config: ServerConfig) {
    this.config = config
  }

  async start(): Promise<void> {
    logger.info(`Starting BrowserOS Server v${VERSION}`)

    this.initCoreServices()

    const dailyRateLimit = await fetchDailyRateLimit(identity.getBrowserOSId())

    const { controllerBridge, controllerContext } = this.createController()
    this.controllerBridge = controllerBridge

    const cdpContext = await this.connectToCdp()

    logger.info(
      `Loaded ${(await import('./tools/index.js')).allControllerTools.length} controller (extension) tools`,
    )
    const tools = createToolRegistry(cdpContext, controllerContext)
    const toolMutex = new Mutex()

    this.httpServer = createHttpServer({
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

    logger.info(
      `HTTP server listening on http://127.0.0.1:${this.config.serverPort}`,
    )
    logger.info(
      `Health endpoint: http://127.0.0.1:${this.config.serverPort}/health`,
    )

    this.logStartupSummary()
  }

  stop(): void {
    logger.info('Shutting down server...')

    const forceExitTimeout = setTimeout(() => {
      logger.warn('Graceful shutdown timed out, forcing exit')
      process.exit(1)
    }, 500)

    Promise.all([
      Promise.resolve(this.httpServer?.server.stop()),
      this.controllerBridge?.close(),
      metrics.shutdown(),
    ])
      .then(() => {
        clearTimeout(forceExitTimeout)
        logger.info('Server shutdown complete')
        process.exit(0)
      })
      .catch((err) => {
        clearTimeout(forceExitTimeout)
        logger.error('Shutdown error:', err)
        process.exit(1)
      })
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
    })

    Sentry.setContext('browseros', {
      client_id: this.config.instanceClientId,
      install_id: this.config.instanceInstallId,
      browseros_version: this.config.instanceBrowserosVersion,
      chromium_version: this.config.instanceChromiumVersion,
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

  private createController(): {
    controllerBridge: ControllerBridge
    controllerContext: ControllerContext
  } {
    logger.info(
      `Controller server starting on ws://127.0.0.1:${this.config.extensionPort}`,
    )
    const controllerBridge = new ControllerBridge(
      this.config.extensionPort,
      logger,
    )
    const controllerContext = new ControllerContext(controllerBridge)
    return { controllerBridge, controllerContext }
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
      const { allCdpTools } = await import('./tools/index.js')
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
