/**
 * @license
 * Copyright 2025 BrowserOS
 *
 * Low-level BrowserOS process management.
 * Use setup.ts:ensureBrowserOS() for the full test environment.
 */
import type { ChildProcess } from 'node:child_process'
import { spawn } from 'node:child_process'
import { rmSync } from 'node:fs'

export interface BrowserConfig {
  cdpPort: number
  serverPort: number
  extensionPort: number
  binaryPath: string
  userDataDir: string
  headless: boolean
}

interface BrowserState {
  process: ChildProcess
  userDataDir: string
  config: BrowserConfig
}

let browserState: BrowserState | null = null

export async function isBrowserRunning(cdpPort: number): Promise<boolean> {
  try {
    const response = await fetch(`http://127.0.0.1:${cdpPort}/json/version`, {
      signal: AbortSignal.timeout(1000),
    })
    return response.ok
  } catch {
    return false
  }
}

async function waitForCdp(cdpPort: number, maxAttempts = 30): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    if (await isBrowserRunning(cdpPort)) {
      return
    }
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  throw new Error(`CDP failed to start on port ${cdpPort} within timeout`)
}

export function getBrowserState(): BrowserState | null {
  return browserState
}

export async function spawnBrowser(
  config: BrowserConfig,
): Promise<BrowserState> {
  if (browserState && browserState.config.cdpPort === config.cdpPort) {
    if (await isBrowserRunning(config.cdpPort)) {
      console.log(`Reusing existing browser on CDP port ${config.cdpPort}`)
      return browserState
    }
  }

  if (browserState) {
    console.log('Config changed, cleaning up existing browser...')
    await killBrowser()
  }

  console.log(`Starting BrowserOS on CDP port ${config.cdpPort}...`)
  const browserProcess = spawn(
    config.binaryPath,
    [
      '--use-mock-keychain',
      '--show-component-extension-options',
      '--enable-logging=stderr',
      ...(config.headless ? ['--headless=new'] : []),
      `--user-data-dir=${config.userDataDir}`,
      // TODO: replace with --browseros-cdp-port once we fix the browseros bug
      `--remote-debugging-port=${config.cdpPort}`,
      `--browseros-mcp-port=${config.serverPort}`,
      `--browseros-extension-port=${config.extensionPort}`,
      '--disable-browseros-server',
    ],
    {
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  )

  browserProcess.stdout?.on('data', (_data) => {
    // Uncomment for debugging
    // console.log(`[BROWSER] ${_data.toString().trim()}`)
  })

  browserProcess.stderr?.on('data', (_data) => {
    // Uncomment for debugging
    // console.log(`[BROWSER] ${_data.toString().trim()}`)
  })

  browserProcess.on('error', (error) => {
    console.error('Failed to start BrowserOS:', error)
  })

  console.log('Waiting for CDP to be ready...')
  await waitForCdp(config.cdpPort)
  console.log('CDP is ready')

  browserState = {
    process: browserProcess,
    userDataDir: config.userDataDir,
    config,
  }
  return browserState
}

export async function killBrowser(): Promise<void> {
  if (!browserState) {
    return
  }

  console.log('Shutting down BrowserOS...')
  browserState.process.kill('SIGTERM')

  await new Promise<void>((resolve) => {
    const timeout = setTimeout(() => {
      browserState?.process.kill('SIGKILL')
      resolve()
    }, 5000)

    browserState?.process.on('exit', () => {
      clearTimeout(timeout)
      resolve()
    })
  })

  console.log('BrowserOS stopped')

  if (browserState.userDataDir) {
    console.log(`Cleaning up temp profile: ${browserState.userDataDir}`)
    try {
      rmSync(browserState.userDataDir, { recursive: true, force: true })
    } catch (error) {
      console.error('Failed to clean up temp directory:', error)
    }
  }

  browserState = null
}
