/**
 * @license
 * Copyright 2025 BrowserOS
 */

import { afterEach, describe, expect, it, mock } from 'bun:test'

const config = {
  cdpPort: 9222,
  serverPort: 9100,
  agentPort: 9100,
  extensionPort: 9300,
  resourcesDir: '/tmp/browseros-resources',
  executionDir: '/tmp/browseros-execution',
  mcpAllowRemote: false,
}

describe('Application.start', () => {
  afterEach(() => {
    mock.restore()
  })

  it('continues when controller startup fails', async () => {
    const createHttpServer = mock(async () => ({}))
    const controllerStart = mock(async () => {
      throw new Error('bind failed')
    })
    const cdpConnect = mock(async () => {})
    const sentryCaptureException = mock(() => {})
    const loggerInfo = mock(() => {})
    const loggerWarn = mock(() => {})
    const loggerDebug = mock(() => {})
    const loggerError = mock(() => {})

    mock.module('../src/api/server', () => ({
      createHttpServer,
    }))
    mock.module('../src/browser/backends/controller', () => ({
      ControllerBackend: class {
        async start(): Promise<void> {
          await controllerStart()
        }

        async stop(): Promise<void> {}

        isConnected(): boolean {
          return false
        }

        async send(): Promise<never> {
          throw new Error('BrowserOS helper service not connected')
        }
      },
    }))
    mock.module('../src/browser/backends/cdp', () => ({
      CdpBackend: class {
        async connect(): Promise<void> {
          await cdpConnect()
        }
      },
    }))
    mock.module('../src/browser/browser', () => ({
      Browser: class {},
    }))
    mock.module('../src/lib/browseros-dir', () => ({
      ensureBrowserosDir: mock(async () => {}),
    }))
    mock.module('../src/lib/db', () => ({
      initializeDb: mock(() => ({}) as never),
    }))
    mock.module('../src/lib/identity', () => ({
      identity: {
        initialize: mock(() => {}),
        getBrowserOSId: mock(() => 'browseros-id'),
      },
    }))
    mock.module('../src/lib/logger', () => ({
      logger: {
        setLogFile: mock(() => {}),
        info: loggerInfo,
        warn: loggerWarn,
        debug: loggerDebug,
        error: loggerError,
      },
    }))
    mock.module('../src/lib/metrics', () => ({
      metrics: {
        initialize: mock(() => {}),
        isEnabled: mock(() => true),
        log: mock(() => {}),
      },
    }))
    mock.module('../src/lib/rate-limiter/fetch-config', () => ({
      fetchDailyRateLimit: mock(async () => 100),
    }))
    mock.module('../src/lib/rate-limiter/rate-limiter', () => ({
      RateLimiter: class {},
    }))
    mock.module('../src/lib/sentry', () => ({
      Sentry: {
        setContext: mock(() => {}),
        captureException: sentryCaptureException,
      },
    }))
    mock.module('../src/lib/soul', () => ({
      seedSoulTemplate: mock(async () => {}),
    }))
    mock.module('../src/tools/registry', () => ({
      registry: {
        names: () => ['test_tool'],
      },
    }))

    const { Application } = await import('../src/main')
    const app = new Application(config)

    await app.start()

    expect(controllerStart).toHaveBeenCalledTimes(1)
    expect(cdpConnect).toHaveBeenCalledTimes(1)
    expect(createHttpServer).toHaveBeenCalledTimes(1)
    expect(sentryCaptureException).toHaveBeenCalledTimes(1)

    const warningCall = loggerWarn.mock.calls.find(
      ([message]) =>
        message ===
        'Controller WebSocket server unavailable, continuing without controller bridge',
    )
    expect(warningCall).toBeDefined()
    expect(warningCall?.[1]).toEqual({
      port: config.extensionPort,
      error: 'bind failed',
    })

    expect(
      loggerInfo.mock.calls.some(
        ([message]) => message === '  Controller Server: unavailable',
      ),
    ).toBe(true)
    expect(loggerError).not.toHaveBeenCalled()
  })
})
