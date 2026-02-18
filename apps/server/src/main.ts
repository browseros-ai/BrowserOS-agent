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
import { createHttpServer } from './api/server'
import { CdpClient } from './browser/cdp/cdp-client'
import { ensureBrowserConnected } from './browser/cdp/connection'
import { ControllerBridge } from './browser/extension/bridge'
import { PageRegistry } from './browser/page-registry'
import type { ServerConfig } from './config'
import { INLINED_ENV } from './env'
import { initializeDb } from './lib/db'

import { identity } from './lib/identity'
import { logger } from './lib/logger'
import { metrics } from './lib/metrics'
import { isPortInUseError } from './lib/port-binding'
import { fetchDailyRateLimit } from './lib/rate-limiter/fetch-config'
import { RateLimiter } from './lib/rate-limiter/rate-limiter'
import { Sentry } from './lib/sentry'
import { logger as cdpDebugLogger } from './tools/cdp/context/logger'
import { createToolRegistry } from './tools/registry'
import { VERSION } from './version'

export class Application {
  private config: ServerConfig
  private db: Database | null = null
  private cdpClient: CdpClient | null = null
  private cdpClientInit: Promise<CdpClient | null> | null = null
  private pageRegistry = new PageRegistry()

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

    let controllerBridge: ControllerBridge
    try {
      controllerBridge = await this.createControllerBridge()
    } catch (error) {
      return this.handleStartupError(
        'WebSocket server',
        this.config.extensionPort,
        error,
      )
    }

    const cdpEnabled = !!this.config.cdpPort

    logger.info(
      `Loaded ${(await import('./tools/controller/registry')).allControllerTools.length} controller (extension) tools`,
    )
    const tools = createToolRegistry(cdpEnabled)

    try {
      await createHttpServer({
        port: this.config.serverPort,
        host: '0.0.0.0',
        version: VERSION,
        tools,
        ensureCdpClient: () => this.ensureCdpClient(),
        controllerBridge,
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

  private async createControllerBridge(): Promise<ControllerBridge> {
    const port = this.config.extensionPort
    logger.info(`Controller server starting on ws://127.0.0.1:${port}`)

    const bridge = new ControllerBridge(port, logger)
    await bridge.waitForReady()
    return bridge
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

  private async connectToCdp(): Promise<CdpClient | null> {
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
      const client = await CdpClient.from(
        browser,
        cdpDebugLogger,
        { experimentalDevToolsDebugging: false },
        this.pageRegistry,
      )
      const { allCdpTools } = await import('./tools/cdp/registry')
      logger.info(`Loaded ${allCdpTools.length} CDP tools`)
      return client
    } catch (error) {
      logger.warn(
        `Warning: Could not connect to CDP at http://127.0.0.1:${this.config.cdpPort}`,
        { error: error instanceof Error ? error.message : String(error) },
      )
      logger.warn(
        'CDP tools will not be available. Only extension tools will work.',
      )
      return null
    }
  }

  private async ensureCdpClient(): Promise<CdpClient | null> {
    if (this.cdpClient) {
      return this.cdpClient
    }
    if (!this.config.cdpPort) {
      return null
    }
    if (!this.cdpClientInit) {
      this.cdpClientInit = this.connectToCdp()
    }
    const client = await this.cdpClientInit
    if (client) {
      this.cdpClient = client
    }
    // Allow retries if connection failed (client is null).
    this.cdpClientInit = null
    return client
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
