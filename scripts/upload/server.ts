#!/usr/bin/env bun
/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

/**
 * Upload BrowserOS server artifacts to Cloudflare R2
 *
 * Zips each platform's resources/ directory and uploads to R2.
 * Compatible with the Chromium build pipeline (download_resources.yaml)
 * and OTA update flow (browseros_server_updater.cc).
 *
 * R2 structure:
 *   server/v{version}/browseros-server-{platform}.zip
 *
 * Each zip contains:
 *   resources/
 *     bin/bun          - Platform-specific Bun runtime
 *     index.js         - Bundled server
 *     index.js.map     - Source map
 *
 * Credentials: copy scripts/.env.example → scripts/.env and fill in values.
 * Explicit env vars override scripts/.env values.
 *
 * Usage:
 *   bun scripts/upload/server.ts [--target=darwin-arm64] [--dry-run]
 *
 * Options:
 *   --target   Platform to upload (default: all built platforms found in dist/)
 *   --dry-run  Show what would be uploaded without uploading
 */

import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { parse } from 'dotenv'

import { log } from '../build/log'

function loadScriptsEnv(): void {
  const envPath = join(import.meta.dir, '..', '.env')
  if (!existsSync(envPath)) return
  const vars = parse(readFileSync(envPath, 'utf-8'))
  for (const [key, value] of Object.entries(vars)) {
    if (!process.env[key]) process.env[key] = value
  }
}

const DIST_DIR = 'dist/server'

const PLATFORMS = [
  'darwin-arm64',
  'darwin-x64',
  'linux-arm64',
  'linux-x64',
  'windows-x64',
] as const

type Platform = (typeof PLATFORMS)[number]

interface R2Config {
  accountId: string
  accessKeyId: string
  secretAccessKey: string
  bucket: string
  cdnBaseUrl: string
}

interface UploadConfig {
  targets: Platform[]
  version: string
  dryRun: boolean
  r2: R2Config
}

function parseArgs(): { targets: Platform[] | 'auto'; dryRun: boolean } {
  const args = process.argv.slice(2)
  let targetArg = 'auto'
  let dryRun = false

  for (const arg of args) {
    if (arg.startsWith('--target=')) {
      targetArg = arg.split('=')[1]
    } else if (arg === '--dry-run') {
      dryRun = true
    }
  }

  if (targetArg === 'auto') {
    return { targets: 'auto', dryRun }
  }

  if (targetArg === 'all') {
    return { targets: [...PLATFORMS], dryRun }
  }

  const targets = targetArg.split(',').map((t) => t.trim()) as Platform[]
  for (const t of targets) {
    if (!PLATFORMS.includes(t)) {
      throw new Error(
        `Invalid target: ${t}. Available: ${PLATFORMS.join(', ')}, all`,
      )
    }
  }

  return { targets, dryRun }
}

function loadR2Config(): R2Config {
  const accountId = process.env.R2_ACCOUNT_ID
  const accessKeyId = process.env.R2_ACCESS_KEY_ID
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error(
      'Missing R2 credentials. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY',
    )
  }

  return {
    accountId,
    accessKeyId,
    secretAccessKey,
    bucket: process.env.R2_BUCKET ?? 'browseros',
    cdnBaseUrl: process.env.R2_CDN_BASE_URL ?? 'https://cdn.browseros.com',
  }
}

function getServerVersion(rootDir: string): string {
  const pkgPath = join(rootDir, 'apps/server/package.json')
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
  return pkg.version
}

function detectBuiltPlatforms(): Platform[] {
  const found: Platform[] = []
  for (const platform of PLATFORMS) {
    const resourcesDir = join(
      DIST_DIR,
      `browseros-server-${platform}`,
      'resources',
    )
    if (existsSync(resourcesDir)) {
      found.push(platform)
    }
  }
  return found
}

function validatePlatformBuild(platform: Platform): string {
  const resourcesDir = join(
    DIST_DIR,
    `browseros-server-${platform}`,
    'resources',
  )

  if (!existsSync(resourcesDir)) {
    throw new Error(
      `Build not found for ${platform}. Run: bun scripts/build/server-new.ts --target=${platform}`,
    )
  }

  const bunBinary = platform.startsWith('windows')
    ? join(resourcesDir, 'bin', 'bun.exe')
    : join(resourcesDir, 'bin', 'bun')
  const indexJs = join(resourcesDir, 'index.js')

  if (!existsSync(bunBinary)) {
    throw new Error(`Missing bun binary: ${bunBinary}`)
  }
  if (!existsSync(indexJs)) {
    throw new Error(`Missing index.js: ${indexJs}`)
  }

  return resourcesDir
}

async function createZip(
  resourcesDir: string,
  outputPath: string,
): Promise<void> {
  const absOutput = resolve(outputPath)
  const proc = Bun.spawn(['zip', '-r', '-q', absOutput, 'resources'], {
    cwd: join(resourcesDir, '..'),
    stdout: 'pipe',
    stderr: 'pipe',
  })

  const exitCode = await proc.exited
  if (exitCode !== 0) {
    const stderr = await new Response(proc.stderr).text()
    throw new Error(`zip failed: ${stderr}`)
  }
}

function createS3Client(config: R2Config): S3Client {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  })
}

async function uploadToR2(
  client: S3Client,
  filePath: string,
  r2Key: string,
  bucket: string,
): Promise<void> {
  const fileStream = createReadStream(filePath)
  const fileSize = statSync(filePath).size

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: r2Key,
      Body: fileStream,
      ContentLength: fileSize,
      ContentType: 'application/zip',
    }),
  )
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

async function upload(config: UploadConfig): Promise<void> {
  const { targets, version, dryRun, r2 } = config

  log.header(`Uploading BrowserOS server v${version}`)
  log.info(`Bucket: ${r2.bucket}`)
  log.info(`CDN: ${r2.cdnBaseUrl}`)
  log.info(`Targets: ${targets.join(', ')}`)
  if (dryRun) log.warn('DRY RUN — nothing will be uploaded')

  for (const platform of targets) {
    validatePlatformBuild(platform)
  }

  const client = dryRun ? null : createS3Client(r2)
  const tmpDir = join(DIST_DIR, '.upload-tmp')
  const { mkdirSync, rmSync } = await import('node:fs')
  rmSync(tmpDir, { recursive: true, force: true })
  mkdirSync(tmpDir, { recursive: true })

  const uploaded: { platform: Platform; r2Key: string; size: number }[] = []

  for (const platform of targets) {
    const resourcesDir = validatePlatformBuild(platform)
    const zipName = `browseros-server-${platform}.zip`
    const zipPath = join(tmpDir, zipName)
    const r2Key = `server/v${version}/${zipName}`

    log.step(`Zipping ${platform}...`)
    await createZip(resourcesDir, zipPath)

    const size = statSync(zipPath).size
    log.info(`${zipName} (${formatBytes(size)})`)

    if (dryRun) {
      log.info(`Would upload → ${r2Key}`)
    } else if (client) {
      log.step(`Uploading ${platform}...`)
      await uploadToR2(client, zipPath, r2Key, r2.bucket)
      log.success(`${platform} → ${r2Key}`)
    }

    uploaded.push({ platform, r2Key, size })
  }

  rmSync(tmpDir, { recursive: true, force: true })

  log.done(dryRun ? 'Dry run completed' : 'Upload completed')
  for (const { platform, r2Key, size } of uploaded) {
    log.info(`${platform}: ${r2.cdnBaseUrl}/${r2Key} (${formatBytes(size)})`)
  }
}

async function main(): Promise<void> {
  loadScriptsEnv()
  const rootDir = resolve(import.meta.dir, '../..')
  process.chdir(rootDir)

  const { targets: targetArg, dryRun } = parseArgs()
  const version = getServerVersion(rootDir)

  let targets: Platform[]
  if (targetArg === 'auto') {
    targets = detectBuiltPlatforms()
    if (targets.length === 0) {
      throw new Error(
        'No built platforms found in dist/server/. Run server-new.ts first.',
      )
    }
    log.info(`Auto-detected: ${targets.join(', ')}`)
  } else {
    targets = targetArg
  }

  const r2 = loadR2Config()

  await upload({ targets, version, dryRun, r2 })
}

main().catch((error) => {
  log.fail(error.message)
  process.exit(1)
})
