#!/usr/bin/env bun
/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

/**
 * Build script for BrowserOS server — produces a single index.js bundle.
 *
 * Output:
 *   dist/server_new/index.js   # minified server bundle with inlined WASM
 *
 * Usage:
 *   bun scripts/build/server-new.ts --mode=prod
 *   bun scripts/build/server-new.ts --mode=dev
 *
 * Modes:
 *   prod - Clean env build from .env.production, uploads sourcemaps to Sentry
 *   dev  - Shell env + .env.development
 */

import { mkdirSync, readFileSync, rmSync } from 'node:fs'
import { join, resolve } from 'node:path'

import { parse } from 'dotenv'

import { log } from './log'
import { wasmBinaryPlugin } from './plugins/wasm-binary'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DIST_DIR = 'dist/server_new'
const SOURCEMAPS_DIR = join(DIST_DIR, '.sourcemaps')

const REQUIRED_PROD_VARS = [
  'BROWSEROS_CONFIG_URL',
  'CODEGEN_SERVICE_URL',
  'POSTHOG_API_KEY',
  'SENTRY_DSN',
  'SENTRY_AUTH_TOKEN',
  'SENTRY_ORG',
  'SENTRY_PROJECT',
]

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArgs(): { mode: 'prod' | 'dev' } {
  const args = process.argv.slice(2)
  let mode: 'prod' | 'dev' = 'prod'

  for (const arg of args) {
    if (arg.startsWith('--mode=')) {
      const value = arg.split('=')[1]
      if (value !== 'prod' && value !== 'dev') {
        throw new Error(`Invalid mode: ${value}. Must be 'prod' or 'dev'`)
      }
      mode = value
    }
  }

  return { mode }
}

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------

function loadEnvFile(path: string): Record<string, string> {
  return parse(readFileSync(path, 'utf-8'))
}

function validateProdEnv(envVars: Record<string, string>): void {
  const missing = REQUIRED_PROD_VARS.filter((v) => !envVars[v]?.trim())
  if (missing.length > 0) {
    throw new Error(
      `Production build requires: ${missing.join(', ')}. Set in .env.production`,
    )
  }
}

// ---------------------------------------------------------------------------
// Versioning
// ---------------------------------------------------------------------------

function getServerVersion(rootDir: string): string {
  const pkg = JSON.parse(
    readFileSync(join(rootDir, 'apps/server/package.json'), 'utf-8'),
  )
  return pkg.version
}

// ---------------------------------------------------------------------------
// Shell helper
// ---------------------------------------------------------------------------

async function run(cmd: string[], env?: Record<string, string>): Promise<void> {
  const proc = Bun.spawn(cmd, {
    env: env ?? (process.env as Record<string, string>),
    stdout: 'inherit',
    stderr: 'inherit',
  })
  const code = await proc.exited
  if (code !== 0) {
    throw new Error(`${cmd.join(' ')} exited with code ${code}`)
  }
}

// ---------------------------------------------------------------------------
// Bundle
// ---------------------------------------------------------------------------

async function bundleServer(envVars: Record<string, string>): Promise<void> {
  const defines = Object.fromEntries(
    Object.entries(envVars).map(([k, v]) => [
      `process.env.${k}`,
      JSON.stringify(v),
    ]),
  )

  const result = await Bun.build({
    entrypoints: ['apps/server/src/index.ts'],
    outdir: DIST_DIR,
    target: 'bun',
    minify: true,
    sourcemap: 'none',
    define: defines,
    external: ['node-pty'],
    plugins: [wasmBinaryPlugin()],
  })

  if (!result.success) {
    for (const entry of result.logs) log.error(String(entry))
    throw new Error('Bundle failed')
  }
}

// ---------------------------------------------------------------------------
// Source maps (prod only)
// ---------------------------------------------------------------------------

async function buildAndUploadSourceMaps(
  version: string,
  envVars: Record<string, string>,
): Promise<void> {
  rmSync(SOURCEMAPS_DIR, { recursive: true, force: true })
  mkdirSync(SOURCEMAPS_DIR, { recursive: true })

  const buildEnv: Record<string, string> = {
    PATH: process.env.PATH ?? '',
    ...envVars,
  }

  await run(
    [
      'bun',
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
    ],
    buildEnv,
  )

  const sentryEnv: Record<string, string> = {
    PATH: process.env.PATH ?? '',
    SENTRY_AUTH_TOKEN: envVars.SENTRY_AUTH_TOKEN,
    SENTRY_ORG: envVars.SENTRY_ORG,
    SENTRY_PROJECT: envVars.SENTRY_PROJECT,
  }

  await run(['sentry-cli', 'sourcemaps', 'inject', SOURCEMAPS_DIR], sentryEnv)
  await run(
    [
      'sentry-cli',
      'sourcemaps',
      'upload',
      '--release',
      version,
      SOURCEMAPS_DIR,
    ],
    sentryEnv,
  )

  rmSync(SOURCEMAPS_DIR, { recursive: true, force: true })
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const rootDir = resolve(import.meta.dir, '../..')
  process.chdir(rootDir)

  const { mode } = parseArgs()
  const version = getServerVersion(rootDir)

  const envFile =
    mode === 'prod'
      ? 'apps/server/.env.production'
      : 'apps/server/.env.development'
  const envVars = loadEnvFile(join(rootDir, envFile))

  if (mode === 'prod') validateProdEnv(envVars)

  log.header(`BrowserOS server v${version}`)
  log.info(`Mode: ${mode}`)
  log.info(`Output: ${DIST_DIR}/index.js`)

  // 1. Source maps → Sentry (prod only)
  if (mode === 'prod' && envVars.SENTRY_AUTH_TOKEN) {
    log.step('Building and uploading source maps...')
    await buildAndUploadSourceMaps(version, envVars)
    log.success('Source maps uploaded to Sentry')
  }

  // 2. Bundle server → single index.js with inlined WASM
  mkdirSync(DIST_DIR, { recursive: true })
  log.step('Bundling server...')
  await bundleServer(envVars)

  log.done('Build completed')
  log.info(`${DIST_DIR}/index.js`)
}

main().catch((error) => {
  log.fail(error.message)
  process.exit(1)
})
