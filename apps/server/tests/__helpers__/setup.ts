/**
 * @license
 * Copyright 2025 BrowserOS
 *
 * Unified test environment orchestrator.
 * Ensures server + browser + extension are all ready.
 */
import { TEST_PORTS } from '@browseros/shared/constants/ports'

import {
  type BrowserConfig,
  getBrowserState,
  killBrowser,
  spawnBrowser,
} from './browser'
import { getServerState, killServer, spawnServer } from './server'
import { killProcessOnPort } from './utils'

export interface TestEnvironmentConfig {
  cdpPort: number
  serverPort: number
  extensionPort: number
  skipExtension?: boolean
}

const DEFAULT_CONFIG: TestEnvironmentConfig = {
  cdpPort: Number.parseInt(
    process.env.BROWSEROS_CDP_PORT || String(TEST_PORTS.cdp),
    10,
  ),
  serverPort: Number.parseInt(
    process.env.BROWSEROS_SERVER_PORT || String(TEST_PORTS.server),
    10,
  ),
  extensionPort: Number.parseInt(
    process.env.BROWSEROS_EXTENSION_PORT || String(TEST_PORTS.extension),
    10,
  ),
}

const DEFAULT_BINARY_PATH =
  process.env.BROWSEROS_BINARY ??
  '/Applications/BrowserOS.app/Contents/MacOS/BrowserOS'

async function isExtensionConnected(port: number): Promise<boolean> {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/extension-status`, {
      signal: AbortSignal.timeout(1000),
    })
    if (response.ok) {
      const data = (await response.json()) as { extensionConnected: boolean }
      return data.extensionConnected
    }
  } catch {
    // Not connected yet
  }
  return false
}

async function waitForExtensionConnection(
  port: number,
  maxAttempts = 30,
): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    if (await isExtensionConnected(port)) {
      return
    }
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  throw new Error(`Extension failed to connect on port ${port} within timeout`)
}

function configsMatch(
  a: TestEnvironmentConfig,
  b: TestEnvironmentConfig,
): boolean {
  return (
    a.cdpPort === b.cdpPort &&
    a.serverPort === b.serverPort &&
    a.extensionPort === b.extensionPort
  )
}

/**
 * Ensures the full BrowserOS test environment is ready:
 * 1. Server running and healthy
 * 2. Browser running with CDP available
 * 3. Extension connected to server
 *
 * Reuses existing processes if already running with same config.
 */
export async function ensureBrowserOS(
  options?: Partial<TestEnvironmentConfig>,
): Promise<TestEnvironmentConfig> {
  const config: TestEnvironmentConfig = {
    cdpPort: options?.cdpPort ?? DEFAULT_CONFIG.cdpPort,
    serverPort: options?.serverPort ?? DEFAULT_CONFIG.serverPort,
    extensionPort: options?.extensionPort ?? DEFAULT_CONFIG.extensionPort,
    skipExtension: options?.skipExtension ?? false,
  }

  // Fast path: already running with same config
  const serverState = getServerState()
  const browserState = getBrowserState()
  if (
    serverState &&
    browserState &&
    configsMatch(serverState.config, config) &&
    configsMatch(browserState.config, config)
  ) {
    if (
      config.skipExtension ||
      (await isExtensionConnected(config.serverPort))
    ) {
      console.log('Reusing existing test environment')
      return config
    }
  }

  // Config changed or not running: full setup
  console.log('\n=== Setting up BrowserOS test environment ===')

  // 1. Kill conflicting processes on ports
  await killProcessOnPort(config.serverPort)
  await killProcessOnPort(config.extensionPort)
  await killProcessOnPort(config.cdpPort)

  // 2. Start server first (WebSocket ready for extension)
  await spawnServer(config)

  // 3. Start browser (extension will connect to server)
  const browserConfig: BrowserConfig = {
    ...config,
    binaryPath: DEFAULT_BINARY_PATH,
  }
  await spawnBrowser(browserConfig)

  // 4. Wait for extension to connect (unless skipped for CDP-only tests)
  if (!config.skipExtension) {
    console.log('Waiting for extension to connect...')
    await waitForExtensionConnection(config.serverPort)
    console.log('Extension connected')
  } else {
    console.log('Skipping extension connection (CDP-only mode)')
  }

  console.log('=== Test environment ready ===\n')
  return config
}

/**
 * Cleans up the full BrowserOS test environment.
 */
export async function cleanupBrowserOS(): Promise<void> {
  console.log('\n=== Cleaning up BrowserOS test environment ===')
  await killBrowser()
  await killServer()
  console.log('=== Cleanup complete ===\n')
}
