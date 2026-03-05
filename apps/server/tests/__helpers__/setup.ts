/**
 * @license
 * Copyright 2025 BrowserOS
 *
 * Unified test environment orchestrator.
 * Ensures server + browser + extension are all ready.
 */
import {
  type BrowserConfig,
  getBrowserState,
  killBrowser,
  spawnBrowser,
} from './browser'
import { getServerState, killServer, spawnServer } from './server'
import { createTestRuntimePlan, type TestRuntimePlan } from './test-runtime'
import { killProcessOnPort } from './utils'

export interface TestEnvironmentConfig {
  cdpPort: number
  serverPort: number
  extensionPort: number
  skipExtension?: boolean
}

let runtimePlan: TestRuntimePlan | null = null

async function isExtensionConnected(port: number): Promise<boolean> {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/status`, {
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
  // Extension startup can be slow on a cold BrowserOS profile.
  // Keep this aligned with typical per-test timeouts (30s).
  maxAttempts = 60,
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
  if (!runtimePlan) {
    runtimePlan = await createTestRuntimePlan()
  }

  const config: TestEnvironmentConfig = {
    cdpPort: options?.cdpPort ?? runtimePlan.ports.cdp,
    serverPort: options?.serverPort ?? runtimePlan.ports.server,
    extensionPort: options?.extensionPort ?? runtimePlan.ports.extension,
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
    if (config.skipExtension) {
      console.log('Reusing existing test environment')
      return config
    }

    if (await isExtensionConnected(config.serverPort)) {
      console.log('Reusing existing test environment')
      return config
    }

    // Same server+browser are already running; we just need the extension.
    // Avoid restarting processes (which can flake by killing the test runner).
    console.log('Reusing existing test environment (waiting for extension)...')
    try {
      await waitForExtensionConnection(config.serverPort)
      console.log('Extension connected')
      return config
    } catch {
      // Fall through to full setup below.
    }
  }

  // Config changed or not running: full setup
  console.log('\n=== Setting up BrowserOS test environment ===')

  // 1. Kill conflicting processes on ports
  await killProcessOnPort(config.serverPort)
  await killProcessOnPort(config.extensionPort)
  await killProcessOnPort(config.cdpPort)

  // 2. Start browser first so CDP is available before server startup.
  const browserConfig: BrowserConfig = {
    ...config,
    binaryPath: runtimePlan.binaryPath,
    userDataDir: runtimePlan.userDataDir,
    headless: runtimePlan.headless,
  }
  await spawnBrowser(browserConfig)

  // 3. Start server once CDP is available.
  await spawnServer(config)

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
  runtimePlan = null
  console.log('=== Cleanup complete ===\n')
}
