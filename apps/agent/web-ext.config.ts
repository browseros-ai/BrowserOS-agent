import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineWebExtConfig } from 'wxt'

// biome-ignore lint/style/noProcessEnv: config file needs env access
const env = process.env

const useBrowserOS = env.USE_BROWSEROS_BINARY === 'true'

const MONOREPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..')
const CONTROLLER_EXT_DIR = join(MONOREPO_ROOT, 'apps/controller-ext/dist')

const chromiumArgs: string[] = []

if (useBrowserOS) {
  chromiumArgs.push('--use-mock-keychain', '--show-component-extension-options')
  chromiumArgs.push(`--load-extension=${CONTROLLER_EXT_DIR}`)

  if (env.BROWSEROS_DISABLE_SERVER === 'true') {
    chromiumArgs.push('--disable-browseros-server')
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
  startUrls: ['chrome://newtab'],
  disabled: !useBrowserOS,
})
