import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { parse } from 'dotenv'

import type { BuildConfig } from './types'

const REQUIRED_PROD_VARS = [
  'BROWSEROS_CONFIG_URL',
  'CODEGEN_SERVICE_URL',
  'POSTHOG_API_KEY',
  'SENTRY_DSN',
]

const REQUIRED_R2_VARS = [
  'R2_ACCOUNT_ID',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_BUCKET',
]

function readServerVersion(rootDir: string): string {
  const pkgPath = join(rootDir, 'apps/server/package.json')
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
  return pkg.version
}

function pickEnv(name: string, fileEnv: Record<string, string>): string {
  const value = process.env[name] ?? fileEnv[name]
  if (!value || value.trim().length === 0) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

function loadProdEnv(rootDir: string): Record<string, string> {
  const path = join(rootDir, 'apps/server/.env.production')
  return parse(readFileSync(path, 'utf-8'))
}

function buildInlineEnv(
  fileEnv: Record<string, string>,
): Record<string, string> {
  const merged: Record<string, string> = {}
  for (const [key, value] of Object.entries(fileEnv)) {
    merged[key] = process.env[key] ?? value
  }
  return merged
}

function validateProductionEnv(envVars: Record<string, string>): void {
  const missing = REQUIRED_PROD_VARS.filter((name) => {
    const value = envVars[name]
    return !value || value.trim().length === 0
  })
  if (missing.length > 0) {
    throw new Error(
      `Production build requires variables: ${missing.join(', ')}`,
    )
  }
}

export function loadBuildConfig(rootDir: string): BuildConfig {
  const fileEnv = loadProdEnv(rootDir)
  const envVars = buildInlineEnv(fileEnv)
  validateProductionEnv(envVars)

  for (const varName of REQUIRED_R2_VARS) {
    pickEnv(varName, envVars)
  }

  const processEnv: NodeJS.ProcessEnv = {
    PATH: process.env.PATH ?? '',
    ...envVars,
  }

  return {
    version: readServerVersion(rootDir),
    envVars,
    processEnv,
    r2: {
      accountId: pickEnv('R2_ACCOUNT_ID', envVars),
      accessKeyId: pickEnv('R2_ACCESS_KEY_ID', envVars),
      secretAccessKey: pickEnv('R2_SECRET_ACCESS_KEY', envVars),
      bucket: pickEnv('R2_BUCKET', envVars),
      downloadPrefix:
        process.env.R2_DOWNLOAD_PREFIX ?? envVars.R2_DOWNLOAD_PREFIX ?? '',
      uploadPrefix:
        process.env.R2_UPLOAD_PREFIX ??
        envVars.R2_UPLOAD_PREFIX ??
        'server/prod-resources',
    },
  }
}
