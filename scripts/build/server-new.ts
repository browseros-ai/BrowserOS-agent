#!/usr/bin/env bun
/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

/**
 * Build script for BrowserOS server
 *
 * Ships the Bun runtime alongside a bundled index.js. Output per platform:
 *
 *   dist/server/browseros-server-{platform}/
 *     resources/
 *       bin/bun       - Platform-specific Bun runtime binary
 *       index.js      - Bundled server (WASM inlined, env vars baked in)
 *       index.js.map  - Linked source map
 *
 * Chromium launches: resources/bin/bun resources/index.js --config=...
 *
 * Usage:
 *   bun scripts/build/server-new.ts --mode=prod [--target=darwin-arm64]
 *   bun scripts/build/server-new.ts --mode=dev [--target=all]
 *
 * Modes:
 *   prod - Clean environment build using only .env.production
 *   dev  - Normal build using shell environment + .env.development
 *
 * Targets:
 *   linux-x64, linux-arm64, windows-x64, darwin-arm64, darwin-x64, all
 */

import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
} from 'node:fs'
import { platform } from 'node:os'
import { join, resolve } from 'node:path'

import { parse } from 'dotenv'

import { log } from './log'
import { wasmBinaryPlugin } from './plugins/wasm-binary'

interface BuildTarget {
  name: string
  /** GitHub release asset name (without .zip), e.g. 'bun-darwin-aarch64' */
  bunReleaseName: string
  outdir: string
  bunBinaryName: string
}

interface BuildConfig {
  mode: 'prod' | 'dev'
  targets: string[]
  version: string
  bunVersion: string
  envVars: Record<string, string>
  buildEnv: NodeJS.ProcessEnv
  rootDir: string
}

const BUN_GITHUB_URL = 'https://github.com/oven-sh/bun/releases/download'

const TARGETS: Record<string, BuildTarget> = {
  'linux-x64': {
    name: 'Linux x64',
    bunReleaseName: 'bun-linux-x64-baseline',
    outdir: 'dist/server/browseros-server-linux-x64',
    bunBinaryName: 'bun',
  },
  'linux-arm64': {
    name: 'Linux ARM64',
    bunReleaseName: 'bun-linux-aarch64',
    outdir: 'dist/server/browseros-server-linux-arm64',
    bunBinaryName: 'bun',
  },
  'windows-x64': {
    name: 'Windows x64',
    bunReleaseName: 'bun-windows-x64-baseline',
    outdir: 'dist/server/browseros-server-windows-x64',
    bunBinaryName: 'bun.exe',
  },
  'darwin-arm64': {
    name: 'macOS ARM64',
    bunReleaseName: 'bun-darwin-aarch64',
    outdir: 'dist/server/browseros-server-darwin-arm64',
    bunBinaryName: 'bun',
  },
  'darwin-x64': {
    name: 'macOS x64',
    bunReleaseName: 'bun-darwin-x64',
    outdir: 'dist/server/browseros-server-darwin-x64',
    bunBinaryName: 'bun',
  },
}

const BUNDLE_DIR = 'dist/server/bundle'
const BUNDLE_ENTRY = join(BUNDLE_DIR, 'index.js')
const BUNDLE_MAP = join(BUNDLE_DIR, 'index.js.map')
const SOURCEMAPS_DIR = 'dist/server/sourcemaps'
const CACHE_DIR = 'dist/server/.cache'
const MINIMAL_SYSTEM_VARS = ['PATH']

const REQUIRED_PROD_VARS = [
  'BROWSEROS_CONFIG_URL',
  'CODEGEN_SERVICE_URL',
  'POSTHOG_API_KEY',
  'SENTRY_DSN',
  'SENTRY_AUTH_TOKEN',
  'SENTRY_ORG',
  'SENTRY_PROJECT',
]

function parseArgs(): { mode: 'prod' | 'dev'; targets: string[] } {
  const args = process.argv.slice(2)
  let mode: 'prod' | 'dev' = 'prod'
  let targetArg = 'all'

  for (const arg of args) {
    if (arg.startsWith('--mode=')) {
      const modeValue = arg.split('=')[1]
      if (modeValue !== 'prod' && modeValue !== 'dev') {
        throw new Error(`Invalid mode: ${modeValue}. Must be 'prod' or 'dev'`)
      }
      mode = modeValue
    } else if (arg.startsWith('--target=')) {
      targetArg = arg.split('=')[1]
    }
  }

  const targets =
    targetArg === 'all'
      ? Object.keys(TARGETS)
      : targetArg.split(',').map((t) => t.trim())

  for (const target of targets) {
    if (!TARGETS[target]) {
      throw new Error(
        `Invalid target: ${target}. Available: ${Object.keys(TARGETS).join(', ')}, all`,
      )
    }
  }

  return { mode, targets }
}

function loadEnvFile(path: string): Record<string, string> {
  const content = readFileSync(path, 'utf-8')
  return parse(content)
}

function validateProdEnv(envVars: Record<string, string>): void {
  const missing = REQUIRED_PROD_VARS.filter(
    (v) => !envVars[v] || envVars[v].trim() === '',
  )

  if (missing.length > 0) {
    throw new Error(
      `Production build requires: ${missing.join(', ')}. Set these in .env.production`,
    )
  }
}

function createBuildEnv(
  mode: 'prod' | 'dev',
  envVars: Record<string, string>,
): NodeJS.ProcessEnv {
  if (mode === 'dev') {
    return { ...process.env, ...envVars }
  }

  const cleanEnv: Record<string, string> = {}
  for (const varName of MINIMAL_SYSTEM_VARS) {
    const value = process.env[varName]
    if (value) cleanEnv[varName] = value
  }
  return { ...cleanEnv, ...envVars }
}

function getServerVersion(rootDir: string): string {
  const pkgPath = join(rootDir, 'apps/server/package.json')
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
  return pkg.version
}

function getBunVersion(rootDir: string): string {
  const pkgPath = join(rootDir, 'package.json')
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
  const pm: string | undefined = pkg.packageManager
  if (!pm?.startsWith('bun@')) {
    throw new Error(
      'Root package.json must have packageManager set to bun@{version}',
    )
  }
  const version = pm.slice(4)
  if (!version) {
    throw new Error(
      'Root package.json packageManager must include version (e.g., bun@1.3.6)',
    )
  }
  return version
}

function runCommand(
  command: string,
  args: string[],
  env: NodeJS.ProcessEnv,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { env, stdio: 'inherit' })
    child.on('close', (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`Command exited with code ${code}`)),
    )
    child.on('error', reject)
  })
}

function runCommandQuiet(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'pipe' })
    let stderr = ''
    child.stderr?.on('data', (data: Buffer) => {
      stderr += data.toString()
    })
    child.on('close', (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`${command} exited with code ${code}: ${stderr}`)),
    )
    child.on('error', reject)
  })
}

// --- Bundle ---

async function bundleWithPlugins(
  envVars: Record<string, string>,
  version: string,
): Promise<void> {
  rmSync(BUNDLE_DIR, { recursive: true, force: true })
  mkdirSync(BUNDLE_DIR, { recursive: true })

  const result = await Bun.build({
    entrypoints: ['apps/server/src/index.ts'],
    outdir: BUNDLE_DIR,
    target: 'bun',
    minify: true,
    sourcemap: 'linked',
    define: {
      ...Object.fromEntries(
        Object.entries(envVars).map(([k, v]) => [
          `process.env.${k}`,
          JSON.stringify(v),
        ]),
      ),
      __BROWSEROS_VERSION__: JSON.stringify(version),
    },
    external: ['node-pty'],
    plugins: [wasmBinaryPlugin()],
  })

  if (!result.success) {
    for (const entry of result.logs) log.error(String(entry))
    throw new Error('Bundle failed')
  }
}

// --- Bun Runtime Download ---

async function fetchSha256Sums(
  bunVersion: string,
): Promise<Map<string, string>> {
  const shasumsPath = join(CACHE_DIR, `bun-v${bunVersion}`, 'SHASUMS256.txt')

  if (existsSync(shasumsPath)) {
    return parseSha256Sums(readFileSync(shasumsPath, 'utf-8'))
  }

  const url = `${BUN_GITHUB_URL}/bun-v${bunVersion}/SHASUMS256.txt`
  const dir = join(CACHE_DIR, `bun-v${bunVersion}`)
  mkdirSync(dir, { recursive: true })

  await runCommand(
    'curl',
    ['-fSL', '--retry', '3', '-o', shasumsPath, url],
    process.env,
  )
  return parseSha256Sums(readFileSync(shasumsPath, 'utf-8'))
}

function parseSha256Sums(content: string): Map<string, string> {
  const sums = new Map<string, string>()
  for (const line of content.split('\n')) {
    const match = line.match(/^([a-f0-9]{64})\s+(.+)$/)
    if (match) sums.set(match[2].trim(), match[1])
  }
  return sums
}

function verifySha256(filePath: string, expectedHash: string): void {
  const data = readFileSync(filePath)
  const actual = createHash('sha256').update(data).digest('hex')
  if (actual !== expectedHash) {
    throw new Error(
      `SHA256 mismatch for ${filePath}\n  expected: ${expectedHash}\n  actual:   ${actual}`,
    )
  }
}

async function extractZip(zipPath: string, extractDir: string): Promise<void> {
  if (platform() === 'win32') {
    await runCommandQuiet('powershell', [
      '-NoProfile',
      '-Command',
      `Expand-Archive -Path '${zipPath}' -DestinationPath '${extractDir}' -Force`,
    ])
  } else {
    await runCommandQuiet('unzip', ['-q', '-o', zipPath, '-d', extractDir])
  }
}

async function downloadBunRuntime(
  bunVersion: string,
  target: BuildTarget,
  sha256Sums: Map<string, string>,
): Promise<string> {
  const cacheDir = join(CACHE_DIR, `bun-v${bunVersion}`, target.bunReleaseName)
  const cachedBinary = join(cacheDir, target.bunBinaryName)

  if (existsSync(cachedBinary)) {
    log.info(`Cached: ${target.name}`)
    return cachedBinary
  }

  const zipName = `${target.bunReleaseName}.zip`
  const url = `${BUN_GITHUB_URL}/bun-v${bunVersion}/${zipName}`
  log.info(`Downloading: ${target.name}`)

  mkdirSync(CACHE_DIR, { recursive: true })
  const zipPath = join(CACHE_DIR, zipName)

  await runCommand(
    'curl',
    ['-fSL', '--retry', '3', '-o', zipPath, url],
    process.env,
  )

  const expectedHash = sha256Sums.get(zipName)
  if (!expectedHash) {
    throw new Error(`No checksum found for ${zipName} in SHASUMS256.txt`)
  }
  verifySha256(zipPath, expectedHash)
  log.info(`Verified: ${target.name}`)

  const extractDir = join(CACHE_DIR, `tmp-${target.bunReleaseName}`)
  rmSync(extractDir, { recursive: true, force: true })
  mkdirSync(extractDir, { recursive: true })

  await extractZip(zipPath, extractDir)

  const extractedBinary = join(
    extractDir,
    target.bunReleaseName,
    target.bunBinaryName,
  )
  if (!existsSync(extractedBinary)) {
    throw new Error(
      `Bun binary not found at expected path: ${target.bunReleaseName}/${target.bunBinaryName}`,
    )
  }

  mkdirSync(cacheDir, { recursive: true })
  copyFileSync(extractedBinary, cachedBinary)

  if (target.bunBinaryName !== 'bun.exe') {
    chmodSync(cachedBinary, 0o755)
  }

  rmSync(extractDir, { recursive: true, force: true })
  rmSync(zipPath, { force: true })

  return cachedBinary
}

// --- Package ---

function packageTarget(target: BuildTarget, bunBinaryPath: string): void {
  const resourcesDir = join(target.outdir, 'resources')
  const binDir = join(resourcesDir, 'bin')

  rmSync(target.outdir, { recursive: true, force: true })
  mkdirSync(binDir, { recursive: true })

  copyFileSync(bunBinaryPath, join(binDir, target.bunBinaryName))
  if (target.bunBinaryName !== 'bun.exe') {
    chmodSync(join(binDir, target.bunBinaryName), 0o755)
  }

  copyFileSync(BUNDLE_ENTRY, join(resourcesDir, 'index.js'))
  if (existsSync(BUNDLE_MAP)) {
    copyFileSync(BUNDLE_MAP, join(resourcesDir, 'index.js.map'))
  }
}

// --- Source Maps ---

async function buildSourceMaps(buildEnv: NodeJS.ProcessEnv): Promise<void> {
  rmSync(SOURCEMAPS_DIR, { recursive: true, force: true })
  mkdirSync(SOURCEMAPS_DIR, { recursive: true })

  const args = [
    'build',
    'apps/server/src/index.ts',
    '--outdir',
    SOURCEMAPS_DIR,
    '--target=bun',
    '--minify',
    '--sourcemap=external',
    '--env',
    'inline',
    '--external=*?binary',
    '--external=node-pty',
  ]

  await runCommand('bun', args, buildEnv)
}

async function uploadSourceMaps(
  version: string,
  envVars: Record<string, string>,
): Promise<void> {
  const uploadEnv: Record<string, string> = {
    PATH: process.env.PATH ?? '',
    SENTRY_AUTH_TOKEN: envVars.SENTRY_AUTH_TOKEN,
    SENTRY_ORG: envVars.SENTRY_ORG,
    SENTRY_PROJECT: envVars.SENTRY_PROJECT,
  }

  await runCommand(
    'sentry-cli',
    ['sourcemaps', 'inject', SOURCEMAPS_DIR],
    uploadEnv,
  )
  await runCommand(
    'sentry-cli',
    ['sourcemaps', 'upload', '--release', version, SOURCEMAPS_DIR],
    uploadEnv,
  )
}

// --- Main Build ---

async function build(config: BuildConfig): Promise<void> {
  const { mode, targets, version, bunVersion, envVars, buildEnv } = config
  const shouldUploadSourceMaps = mode === 'prod' && envVars.SENTRY_AUTH_TOKEN

  log.header(`Building BrowserOS server v${version}`)
  log.info(`Mode: ${mode}`)
  log.info(`Bun runtime: v${bunVersion}`)
  log.info(`Targets: ${targets.join(', ')}`)

  if (mode === 'prod') {
    log.info(
      `Environment: clean (only .env.production + ${MINIMAL_SYSTEM_VARS.join(', ')})`,
    )
  } else {
    log.info('Environment: shell + .env.development')
  }

  mkdirSync('dist/server', { recursive: true })

  if (shouldUploadSourceMaps) {
    log.step('Building source maps...')
    await buildSourceMaps(buildEnv)
    log.success('Source maps built')
  }

  log.step('Bundling with WASM plugin...')
  await bundleWithPlugins(envVars, version)
  log.success('Bundle created with embedded WASM')

  log.step('Fetching bun runtimes...')
  const sha256Sums = await fetchSha256Sums(bunVersion)
  const bunPaths = new Map<string, string>()
  const seen = new Set<string>()
  const downloads: Promise<void>[] = []

  for (const targetKey of targets) {
    const target = TARGETS[targetKey]
    if (seen.has(target.bunReleaseName)) continue
    seen.add(target.bunReleaseName)

    downloads.push(
      downloadBunRuntime(bunVersion, target, sha256Sums).then((path) => {
        bunPaths.set(target.bunReleaseName, path)
      }),
    )
  }

  await Promise.all(downloads)
  log.success('All bun runtimes ready')

  for (const targetKey of targets) {
    const target = TARGETS[targetKey]
    const bunPath = bunPaths.get(target.bunReleaseName)
    if (!bunPath) {
      throw new Error(`No bun binary for ${target.bunReleaseName}`)
    }
    log.step(`Packaging ${target.name}...`)
    packageTarget(target, bunPath)
    log.success(`${target.name} → ${target.outdir}/resources/`)
  }

  rmSync(BUNDLE_DIR, { recursive: true, force: true })

  if (shouldUploadSourceMaps) {
    log.step('Uploading source maps to Sentry...')
    await uploadSourceMaps(version, envVars)
    log.success('Source maps uploaded')
    rmSync(SOURCEMAPS_DIR, { recursive: true, force: true })
  }

  log.done('Build completed')
  for (const targetKey of targets) {
    log.info(`${TARGETS[targetKey].outdir}/resources/`)
  }
}

async function main(): Promise<void> {
  const rootDir = resolve(import.meta.dir, '../..')
  process.chdir(rootDir)

  const { mode, targets } = parseArgs()
  const version = getServerVersion(rootDir)
  const bunVersion = getBunVersion(rootDir)

  const envFile =
    mode === 'prod'
      ? 'apps/server/.env.production'
      : 'apps/server/.env.development'
  const envVars = loadEnvFile(join(rootDir, envFile))

  if (mode === 'prod') {
    validateProdEnv(envVars)
  }

  const buildEnv = createBuildEnv(mode, envVars)

  await build({
    mode,
    targets,
    version,
    bunVersion,
    envVars,
    buildEnv,
    rootDir,
  })
}

main().catch((error) => {
  log.fail(error.message)
  process.exit(1)
})
