#!/usr/bin/env bun
/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

/**
 * Build script for BrowserOS server binaries
 *
 * Usage:
 *   bun scripts/build/server.ts --mode=prod [--target=darwin-arm64]
 *   bun scripts/build/server.ts --mode=dev [--target=all]
 *
 * Modes:
 *   prod - Clean environment build using only .env.prod
 *   dev  - Normal build using shell environment + .env.dev
 *
 * Targets:
 *   linux-x64, linux-arm64, windows-x64, darwin-arm64, darwin-x64, all
 */

import { spawn } from 'node:child_process'
import { mkdirSync, readFileSync, rmSync } from 'node:fs'
import { join, resolve } from 'node:path'

import { parse } from 'dotenv'

interface BuildTarget {
  name: string
  bunTarget: string
  outfile: string
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

const MINIMAL_SYSTEM_VARS = ['PATH']

const REQUIRED_PROD_VARS = [
  'BROWSEROS_CONFIG_URL',
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
        console.error(`Invalid mode: ${modeValue}. Must be 'prod' or 'dev'`)
        process.exit(1)
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
      console.error(`Invalid target: ${target}`)
      console.error(
        `Available targets: ${Object.keys(TARGETS).join(', ')}, all`,
      )
      process.exit(1)
    }
  }

  return { mode, targets }
}

function loadEnvFile(path: string): Record<string, string> {
  try {
    const content = readFileSync(path, 'utf-8')
    const parsed = parse(content)
    return parsed
  } catch (error) {
    console.error(`Failed to load ${path}:`, error)
    process.exit(1)
  }
}

function validateProdEnv(envVars: Record<string, string>): void {
  const missing: string[] = []

  for (const varName of REQUIRED_PROD_VARS) {
    if (!envVars[varName] || envVars[varName].trim() === '') {
      missing.push(varName)
    }
  }

  if (missing.length > 0) {
    console.error(
      `\n❌ Production build requires the following environment variables:`,
    )
    for (const varName of missing) {
      console.error(`   - ${varName}`)
    }
    console.error(`\n   Please set these in .env.prod`)
    process.exit(1)
  }
}

function createCleanEnv(
  envVars: Record<string, string>,
): Record<string, string> {
  const cleanEnv: Record<string, string> = {}

  for (const varName of MINIMAL_SYSTEM_VARS) {
    const value = process.env[varName]
    if (value) {
      cleanEnv[varName] = value
    }
  }

  Object.assign(cleanEnv, envVars)

  return cleanEnv
}

function runCommand(
  command: string,
  args: string[],
  env: NodeJS.ProcessEnv,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      env,
      stdio: 'inherit',
    })

    child.on('close', (code) => {
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`Command exited with code ${code}`))
      }
    })

    child.on('error', (error) => {
      reject(error)
    })
  })
}

async function buildSourceMapBundle(
  buildEnv: NodeJS.ProcessEnv,
): Promise<void> {
  const args = [
    'build',
    'apps/server/src/index.ts',
    '--outdir',
    'dist/server/sourcemaps',
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
    ['sourcemaps', 'inject', 'dist/server/sourcemaps'],
    uploadEnv,
  )

  await runCommand(
    'sentry-cli',
    ['sourcemaps', 'upload', '--release', version, 'dist/server/sourcemaps'],
    uploadEnv,
  )
}

async function buildTarget(
  target: BuildTarget,
  buildEnv: NodeJS.ProcessEnv,
): Promise<void> {
  console.log(`\n📦 Building ${target.name}...`)

  const args = [
    'build',
    '--compile',
    'apps/server/src/index.ts',
    '--outfile',
    target.outfile,
    '--minify',
    '--sourcemap',
    `--target=${target.bunTarget}`,
    '--env',
    'inline',
    '--external=*?binary',
    '--external=node-pty',
  ]

  try {
    await runCommand('bun', args, buildEnv)
    console.log(`✅ ${target.name} built successfully`)

    if (target.outfile.endsWith('.exe')) {
      console.log(`🔧 Patching Windows executable...`)
      await runCommand(
        'bun',
        ['scripts/patch-windows-exe.ts', target.outfile],
        process.env,
      )
    }
  } catch (error) {
    console.error(`❌ Failed to build ${target.name}:`, error)
    throw error
  }
}

async function main() {
  const { mode, targets } = parseArgs()
  const rootDir = resolve(import.meta.dir, '../..')
  process.chdir(rootDir)

  const serverPkg = JSON.parse(
    readFileSync(join(rootDir, 'apps/server/package.json'), 'utf-8'),
  )
  const version = serverPkg.version

  console.log(`🚀 Building BrowserOS server binaries`)
  console.log(`   Version: ${version}`)
  console.log(`   Mode: ${mode}`)
  console.log(`   Targets: ${targets.join(', ')}`)
  console.log(
    `\n   Tip: bun run version:server [patch|minor|major] to bump version`,
  )

  const envFile = mode === 'prod' ? '.env.prod' : '.env.dev'
  const envPath = join(rootDir, envFile)

  console.log(`\n📄 Loading environment from ${envFile}...`)
  const envVars = loadEnvFile(envPath)
  console.log(`   Loaded ${Object.keys(envVars).length} variables`)

  if (mode === 'prod') {
    validateProdEnv(envVars)
    console.log(
      `\n🔒 Production mode: Using CLEAN environment (only ${envFile} + minimal system vars)`,
    )
    console.log(`   System vars: ${MINIMAL_SYSTEM_VARS.join(', ')}`)
  } else {
    console.log(`\n🔓 Development mode: Using shell environment + ${envFile}`)
  }

  mkdirSync('dist/server', { recursive: true })

  const buildEnv =
    mode === 'prod' ? createCleanEnv(envVars) : { ...process.env, ...envVars }

  const shouldUploadSourceMaps = mode === 'prod' && envVars.SENTRY_AUTH_TOKEN

  if (shouldUploadSourceMaps) {
    console.log(`\n🗺️  Building source map bundle...`)
    await buildSourceMapBundle(buildEnv)
    console.log(`✅ Source map bundle created`)
  }

  for (const targetKey of targets) {
    const target = TARGETS[targetKey]
    await buildTarget(target, buildEnv)
  }

  if (shouldUploadSourceMaps) {
    console.log(
      `\n📤 Injecting debug IDs and uploading source maps to Sentry...`,
    )
    await uploadSourceMaps(version, envVars)
    console.log(`✅ Source maps injected and uploaded`)

    rmSync('dist/server/sourcemaps', { recursive: true, force: true })
  }

  console.log(`\n✨ All builds completed successfully!`)
  console.log(`\n📦 Output files:`)
  for (const targetKey of targets) {
    console.log(`   ${TARGETS[targetKey].outfile}`)
  }
}

main().catch((error) => {
  console.error('\n💥 Build failed:', error)
  process.exit(1)
})
