import { TEST_PORTS } from '@browseros/shared/constants/ports'
import { Mutex } from 'async-mutex'
import { CdpBackend } from '../../src/browser/backends/cdp'
import type { ControllerBackend } from '../../src/browser/backends/types'
import { Browser } from '../../src/browser/browser'
import type { ToolDefinition } from '../../src/tools/framework'
import { executeTool } from '../../src/tools/framework'
import type { ToolResult } from '../../src/tools/response'
import { type BrowserConfig, spawnBrowser } from './browser'
import { killProcessOnPort } from './utils'

const cdpPort = Number.parseInt(
  process.env.BROWSEROS_CDP_PORT || String(TEST_PORTS.cdp),
  10,
)
const serverPort = Number.parseInt(
  process.env.BROWSEROS_SERVER_PORT || String(TEST_PORTS.server),
  10,
)
const extensionPort = Number.parseInt(
  process.env.BROWSEROS_EXTENSION_PORT || String(TEST_PORTS.extension),
  10,
)
const binaryPath =
  process.env.BROWSEROS_BINARY ??
  '/Applications/BrowserOS.app/Contents/MacOS/BrowserOS'

const mutex = new Mutex()
let cachedCdp: CdpBackend | null = null
let cachedBrowser: Browser | null = null

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

  await killProcessOnPort(cdpPort)

  const config: BrowserConfig = {
    cdpPort,
    serverPort,
    extensionPort,
    binaryPath,
  }
  await spawnBrowser(config)

  cachedCdp = new CdpBackend({ port: cdpPort })
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
