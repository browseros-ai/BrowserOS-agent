import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineWebExtConfig } from 'wxt'

// biome-ignore lint/style/noProcessEnv: config file needs env access
const env = process.env

const MONOREPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..')
const CONTROLLER_EXT_DIR = join(MONOREPO_ROOT, 'apps/controller-ext/dist')

const chromiumArgs = [
  '--use-mock-keychain',
  '--show-component-extension-options',
  '--disable-browseros-server',
  '--disable-browseros-extensions',
  `--load-extension=${CONTROLLER_EXT_DIR}`,
]

if (env.BROWSEROS_CDP_PORT) {
  // TODO: replace with --browseros-cdp-port once we fix the browseros bug
  chromiumArgs.push(`--remote-debugging-port=${env.BROWSEROS_CDP_PORT}`)
}
if (env.BROWSEROS_SERVER_PORT) {
  chromiumArgs.push(`--browseros-mcp-port=${env.BROWSEROS_SERVER_PORT}`)
}
if (env.BROWSEROS_EXTENSION_PORT) {
  chromiumArgs.push(
    `--browseros-extension-port=${env.BROWSEROS_EXTENSION_PORT}`,
  )
}

export default defineWebExtConfig({
  binaries: {
    chrome:
      env.BROWSEROS_BINARY ||
      '/Applications/BrowserOS.app/Contents/MacOS/BrowserOS',
  },
  chromiumArgs,
  chromiumProfile: '/tmp/browseros-dev',
  keepProfileChanges: true,
  startUrls: ['chrome://newtab'],
})
