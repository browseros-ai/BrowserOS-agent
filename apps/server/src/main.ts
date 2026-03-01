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
import { CdpBackend } from './browser/backends/cdp'
import { ControllerBackend } from './browser/backends/controller'
import { Browser } from './browser/browser'
import type { ServerConfig } from './config'
import { INLINED_ENV } from './env'
import { initializeDb } from './lib/db'

import { createKlavisToolProxy } from './api/services/mcp/kalvis-proxy'
import { KlavisClient } from './lib/clients/klavis/klavis-client'
import { identity } from './lib/identity'
import { logger } from './lib/logger'
import { metrics } from './lib/metrics'
import { isPortInUseError } from './lib/port-binding'
import { fetchDailyRateLimit } from './lib/rate-limiter/fetch-config'
import { RateLimiter } from './lib/rate-limiter/rate-limiter'
import { Sentry } from './lib/sentry'
import { registry } from './tools/registry'
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

    let controller: ControllerBackend
    try {
      logger.debug(
        `Starting WebSocket server on port ${this.config.extensionPort}`,
      )
      controller = new ControllerBackend({ port: this.config.extensionPort })
      await controller.start()
    } catch (error) {
      return this.handleStartupError(
        'WebSocket server',
        this.config.extensionPort,
        error,
      )
    }

    if (!this.config.cdpPort) {
      logger.error('CDP port is required (--cdp-port)')
      process.exit(EXIT_CODES.GENERAL_ERROR)
    }

    const cdp = new CdpBackend({ port: this.config.cdpPort })
    try {
      logger.debug(`Connecting to CDP on port ${this.config.cdpPort}`)
      await cdp.connect()
      logger.info(`Connected to CDP on port ${this.config.cdpPort}`)
    } catch (error) {
      return this.handleStartupError('CDP', this.config.cdpPort, error)
    }

    const browser = new Browser(cdp, controller)

    logger.info(`Loaded ${registry.names().length} unified tools`)

    const klavisProxy = await this.initializeKlavisProxy()

    try {
      await createHttpServer({
        port: this.config.serverPort,
        host: '0.0.0.0',
        version: VERSION,
        browser,
        controller,
        registry,
        browserosId: identity.getBrowserOSId(),
        executionDir: this.config.executionDir,
        rateLimiter: new RateLimiter(this.getDb(), dailyRateLimit),
        klavisProxy,
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

  private async initializeKlavisProxy() {
    const klavisMcpEnabled = process.env.BROWSEROS_KLAVIS_MCP_ENABLED !== 'false'
    const defaultServers = process.env.BROWSEROS_KLAVIS_DEFAULT_SERVERS
      ? process.env.BROWSEROS_KLAVIS_DEFAULT_SERVERS.split(',').map((s) =>
          s.trim(),
        )
      : []

    if (!klavisMcpEnabled || defaultServers.length === 0) {
      logger.info('Kalvis MCP integration disabled or no servers configured', {
        enabled: klavisMcpEnabled,
        servers: defaultServers,
      })
      return undefined
    }

    const klavisClient = new KlavisClient()
    const proxy = createKlavisToolProxy(klavisClient)

    try {
      await proxy.initialize({
        browserosId: identity.getBrowserOSId(),
        servers: defaultServers,
      })

      logger.info('Kalvis MCP proxy initialized', {
        servers: defaultServers,
        toolCount: proxy.getToolCount(),
      })

      return proxy
    } catch (error) {
      logger.warn('Failed to initialize Kalvis MCP proxy, continuing without it', {
        error: error instanceof Error ? error.message : String(error),
        servers: defaultServers,
      })
      return undefined
    }
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

  private handleStartupError(
    serverName: string,
    port: number,
    error: unknown,
  ): never {
    const errorMsg = error instanceof Error ? error.message : String(error)
    logger.error(`Failed to start ${serverName}`, { port, error: errorMsg })
    console.error(
      `[FATAL] Failed to start ${serverName} on port ${port}: ${errorMsg}`,
    )
    Sentry.captureException(error)

    if (isPortInUseError(error)) {
      console.error(
        `[FATAL] Port ${port} is already in use. Chromium should try a different port.`,
      )
      process.exit(EXIT_CODES.PORT_CONFLICT)
    }

    process.exit(EXIT_CODES.GENERAL_ERROR)
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
