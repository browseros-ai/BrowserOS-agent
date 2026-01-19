#!/usr/bin/env bun
/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

/**
 * Build script for BrowserOS server binaries
 *
 * Uses a two-step build process:
 * 1. Bundle with Bun.build() + plugins to embed WASM files inline
 * 2. Compile the bundle to a standalone executable
 *
 * Usage:
 *   bun scripts/build/server.ts --mode=prod [--target=darwin-arm64]
 *   bun scripts/build/server.ts --mode=dev [--target=all]
 *
 * Modes:
 *   prod - Clean environment build using only .env.production
 *   dev  - Normal build using shell environment + .env.development
 *
 * Targets:
 *   linux-x64, linux-arm64, windows-x64, darwin-arm64, darwin-x64, all
 */

import { spawn } from 'node:child_process'
import { mkdirSync, readFileSync, rmSync } from 'node:fs'
import { join, resolve } from 'node:path'

import { parse } from 'dotenv'

import { log } from './log'
import { wasmBinaryPlugin } from './plugins/wasm-binary'

interface BuildTarget {
  name: string
  bunTarget: string
  outfile: string
}

interface BuildConfig {
  mode: 'prod' | 'dev'
  targets: string[]
  version: string
  envVars: Record<string, string>
  buildEnv: NodeJS.ProcessEnv
  rootDir: string
}

const TARGETS: Record<string, BuildTarget> = {
  'linux-x64': {
    name: 'Linux x64',
    bunTarget: 'bun-linux-x64-baseline',
    outfile: 'dist/server/browseros-server-linux-x64',
  },
  'linux-arm64': {
    name: 'Linux ARM64',
    bunTarget: 'bun-linux-arm64',
    outfile: 'dist/server/browseros-server-linux-arm64',
  },
  'windows-x64': {
    name: 'Windows x64',
    bunTarget: 'bun-windows-x64-baseline',
    outfile: 'dist/server/browseros-server-windows-x64.exe',
  },
  'darwin-arm64': {
    name: 'macOS ARM64',
    bunTarget: 'bun-darwin-arm64',
    outfile: 'dist/server/browseros-server-darwin-arm64',
  },
  'darwin-x64': {
    name: 'macOS x64',
    bunTarget: 'bun-darwin-x64',
    outfile: 'dist/server/browseros-server-darwin-x64',
  },
}

const BUNDLE_DIR = 'dist/server/bundle'
const BUNDLE_ENTRY = join(BUNDLE_DIR, 'index.js')
const SOURCEMAPS_DIR = 'dist/server/sourcemaps'
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

async function bundleWithPlugins(
  envVars: Record<string, string>,
): Promise<void> {
  rmSync(BUNDLE_DIR, { recursive: true, force: true })
  mkdirSync(BUNDLE_DIR, { recursive: true })

  const result = await Bun.build({
    entrypoints: ['apps/server/src/index.ts'],
    outdir: BUNDLE_DIR,
    target: 'bun',
    minify: true,
    sourcemap: 'linked',
    define: Object.fromEntries(
      Object.entries(envVars).map(([k, v]) => [
        `process.env.${k}`,
        JSON.stringify(v),
      ]),
    ),
    external: ['node-pty'],
    plugins: [wasmBinaryPlugin()],
  })

  if (!result.success) {
    for (const entry of result.logs) log.error(String(entry))
    throw new Error('Bundle with plugins failed')
  }
}

async function compileTarget(
  target: BuildTarget,
  buildEnv: NodeJS.ProcessEnv,
): Promise<void> {
  const args = [
    'build',
    '--compile',
    BUNDLE_ENTRY,
    '--outfile',
    target.outfile,
    `--target=${target.bunTarget}`,
    '--external=node-pty',
  ]

  await runCommand('bun', args, buildEnv)

  if (target.outfile.endsWith('.exe')) {
    await runCommand(
      'bun',
      ['scripts/patch-windows-exe.ts', target.outfile],
      process.env,
    )
  }
}
rmSync(SOURCEMAPS_DIR, { recursive: true, force: true })
mkdirSync(SOURCEMAPS_DIR, { recursive: true })

async function buildSourceMaps(buildEnv: NodeJS.ProcessEnv): Promise<void> {
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

async function build(config: BuildConfig): Promise<void> {
  const { mode, targets, version, envVars, buildEnv } = config
  const shouldUploadSourceMaps = mode === 'prod' && envVars.SENTRY_AUTH_TOKEN

  log.header(`Building BrowserOS server v${version}`)
  log.info(`Mode: ${mode}`)
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
  await bundleWithPlugins(envVars)
  log.success('Bundle created with embedded WASM')

  for (const targetKey of targets) {
    const target = TARGETS[targetKey]
    log.step(`Compiling ${target.name}...`)
    await compileTarget(target, buildEnv)
    log.success(`${target.name} compiled`)
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
    log.info(TARGETS[targetKey].outfile)
  }
}

async function main(): Promise<void> {
  const rootDir = resolve(import.meta.dir, '../..')
  process.chdir(rootDir)

  const { mode, targets } = parseArgs()
  const version = getServerVersion(rootDir)

  const envFile =
    mode === 'prod'
      ? 'apps/server/.env.production'
      : 'apps/server/.env.development'
  const envVars = loadEnvFile(join(rootDir, envFile))

  if (mode === 'prod') {
    validateProdEnv(envVars)
  }

  const buildEnv = createBuildEnv(mode, envVars)

  await build({ mode, targets, version, envVars, buildEnv, rootDir })
}

main().catch((error) => {
  log.fail(error.message)
  process.exit(1)
})
