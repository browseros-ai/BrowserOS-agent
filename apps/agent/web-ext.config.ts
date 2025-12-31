import { existsSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineWebExtConfig } from 'wxt'

// biome-ignore lint/style/noProcessEnv: config file needs env access
const env = process.env

const useBrowserOS = env.USE_BROWSEROS_BINARY === 'true'

const MONOREPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..')
const CONTROLLER_EXT_DIR = join(MONOREPO_ROOT, 'apps/controller-ext/dist')
const STALE_BUILD_THRESHOLD_MS = 24 * 60 * 60 * 1000

async function ensureControllerExtBuilt(): Promise<void> {
  const manifestPath = join(CONTROLLER_EXT_DIR, 'manifest.json')

  if (!existsSync(manifestPath)) {
    // biome-ignore lint/suspicious/noConsole: intentional logging for dev tooling
    console.log('Controller extension not built, building...')
    const { execSync } = await import('node:child_process')
    execSync('bun run build:ext', { cwd: MONOREPO_ROOT, stdio: 'inherit' })
    return
  }

  const stats = statSync(manifestPath)
  const ageMs = Date.now() - stats.mtimeMs
  if (ageMs > STALE_BUILD_THRESHOLD_MS) {
    const ageDays = Math.floor(ageMs / STALE_BUILD_THRESHOLD_MS)
    // biome-ignore lint/suspicious/noConsole: intentional logging for dev tooling
    console.warn(
      `Controller extension build is ${ageDays} day(s) old. ` +
        'Run "bun run build:ext" to pick up recent changes.',
    )
  }
}

const chromiumArgs: string[] = []

if (useBrowserOS) {
  chromiumArgs.push('--use-mock-keychain', '--show-component-extension-options')

  if (env.BROWSEROS_DISABLE_SERVER === 'true') {
    chromiumArgs.push('--disable-browseros-server')

    await ensureControllerExtBuilt()
    chromiumArgs.push(`--load-extension=${CONTROLLER_EXT_DIR}`)
  }
  if (env.BROWSEROS_CDP_PORT) {
    chromiumArgs.push(`--browseros-cdp-port=${env.BROWSEROS_CDP_PORT}`)
  }
  if (env.BROWSEROS_SERVER_PORT) {
    chromiumArgs.push(`--browseros-mcp-port=${env.BROWSEROS_SERVER_PORT}`)
  }
  if (env.BROWSEROS_EXTENSION_PORT) {
    chromiumArgs.push(
      `--browseros-extension-port=${env.BROWSEROS_EXTENSION_PORT}`,
    )
  }
  if (env.BROWSEROS_USER_DATA_DIR) {
    chromiumArgs.push(`--user-data-dir=${env.BROWSEROS_USER_DATA_DIR}`)
  }
}

export default defineWebExtConfig({
  ...(useBrowserOS && {
    binaries: {
      chrome: '/Applications/BrowserOS.app/Contents/MacOS/BrowserOS',
    },
  }),
  chromiumArgs,
  disabled: !useBrowserOS,
})
