import { Mutex } from 'async-mutex'
import { CdpBackend } from '../../src/browser/backends/cdp'
import type { ControllerBackend } from '../../src/browser/backends/types'
import { Browser } from '../../src/browser/browser'
import type { ToolDefinition } from '../../src/tools/framework'
import { executeTool } from '../../src/tools/framework'
import type { ToolResult } from '../../src/tools/response'
import { type BrowserConfig, spawnBrowser } from './browser'
import { createTestRuntimePlan, type TestRuntimePlan } from './test-runtime'
import { killProcessOnPort } from './utils'

const mutex = new Mutex()
let cachedCdp: CdpBackend | null = null
let cachedBrowser: Browser | null = null
let runtimePlan: TestRuntimePlan | null = null

const stubController: ControllerBackend = {
  start: async () => {},
  stop: async () => {},
  isConnected: () => false,
  send: async () => {
    throw new Error('Controller not available in test mode')
  },
}

async function getOrCreateBrowser(): Promise<Browser> {
  if (cachedBrowser && cachedCdp?.isConnected()) return cachedBrowser

  if (!runtimePlan) {
    runtimePlan = await createTestRuntimePlan()
  }

  if (runtimePlan.usesFixedPorts) {
    await killProcessOnPort(runtimePlan.ports.cdp)
  }

  const config: BrowserConfig = {
    cdpPort: runtimePlan.ports.cdp,
    serverPort: runtimePlan.ports.server,
    extensionPort: runtimePlan.ports.extension,
    binaryPath: runtimePlan.binaryPath,
    userDataDir: runtimePlan.userDataDir,
    headless: runtimePlan.headless,
  }
  await spawnBrowser(config)

  cachedCdp = new CdpBackend({ port: runtimePlan.ports.cdp })
  await cachedCdp.connect()

  cachedBrowser = new Browser(cachedCdp, stubController)
  return cachedBrowser
}

export interface WithBrowserContext {
  browser: Browser
  execute: (tool: ToolDefinition, args: unknown) => Promise<ToolResult>
}

export async function withBrowser(
  cb: (ctx: WithBrowserContext) => Promise<void>,
): Promise<void> {
  return await mutex.runExclusive(async () => {
    const browser = await getOrCreateBrowser()

    const execute = async (
      tool: ToolDefinition,
      args: unknown,
    ): Promise<ToolResult> => {
      const signal = AbortSignal.timeout(30_000)
      return executeTool(tool, args, { browser }, signal)
    }

    await cb({ browser, execute })
  })
}
