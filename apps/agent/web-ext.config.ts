import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { defineWebExtConfig } from 'wxt'

// biome-ignore lint/style/noProcessEnv: config file needs env access
const env = process.env

const useBrowserOS = env.USE_BROWSEROS_BINARY === 'true'

const DEV_EXTENSIONS_DIR = join(import.meta.dirname, '.dev-extensions')
// Controller extension is needed for agent controller MCP tools to work
const CONTROLLER_EXT_URL =
  'https://cdn.browseros.com/extensions/controller-1.0.0.8.crx'
const CONTROLLER_EXT_DIR = join(DEV_EXTENSIONS_DIR, 'controller')

async function downloadAndExtractCrx(
  url: string,
  outputDir: string,
): Promise<void> {
  if (existsSync(outputDir)) {
    // biome-ignore lint/suspicious/noConsole: intentional logging for dev tooling
    console.log(`[web-ext] Extension already extracted at ${outputDir}`)
    return
  }

  // biome-ignore lint/suspicious/noConsole: intentional logging for dev tooling
  console.log(`[web-ext] Downloading CRX from ${url}...`)

  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to download CRX: ${response.statusText}`)
  }

  const buffer = await response.arrayBuffer()
  const bytes = new Uint8Array(buffer)

  // CRX3 format: magic (4) + version (4) + header_length (4) + header + zip
  // Find ZIP start by looking for PK signature (0x50, 0x4B, 0x03, 0x04)
  let zipStart = -1
  for (let i = 0; i < bytes.length - 4; i++) {
    if (
      bytes[i] === 0x50 &&
      bytes[i + 1] === 0x4b &&
      bytes[i + 2] === 0x03 &&
      bytes[i + 3] === 0x04
    ) {
      zipStart = i
      break
    }
  }

  if (zipStart === -1) {
    throw new Error('Could not find ZIP signature in CRX file')
  }

  const zipData = bytes.slice(zipStart)

  mkdirSync(DEV_EXTENSIONS_DIR, { recursive: true })

  const tempZipPath = join(DEV_EXTENSIONS_DIR, 'temp.zip')
  writeFileSync(tempZipPath, zipData)

  mkdirSync(outputDir, { recursive: true })

  const { execSync } = await import('node:child_process')
  execSync(`unzip -o "${tempZipPath}" -d "${outputDir}"`)

  rmSync(tempZipPath)

  // biome-ignore lint/suspicious/noConsole: intentional logging for dev tooling
  console.log(`[web-ext] Extension extracted to ${outputDir}`)
}

const chromiumArgs: string[] = []

if (useBrowserOS) {
  chromiumArgs.push('--use-mock-keychain', '--show-component-extension-options')

  if (env.BROWSEROS_DISABLE_SERVER === 'true') {
    chromiumArgs.push('--disable-browseros-server')

    await downloadAndExtractCrx(CONTROLLER_EXT_URL, CONTROLLER_EXT_DIR)
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
