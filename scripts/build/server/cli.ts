import { resolveTargets } from './targets'
import type { BuildArgs } from './types'

const DEFAULT_MANIFEST_PATH = 'scripts/build/config/server-prod-resources.json'

function parseValueFlag(arg: string, prefix: string): string | null {
  if (!arg.startsWith(prefix)) {
    return null
  }
  const value = arg.slice(prefix.length)
  if (!value) {
    throw new Error(`Missing value for flag ${prefix}`)
  }
  return value
}

export function parseBuildArgs(argv: string[]): BuildArgs {
  let targetArg = 'all'
  let manifestPath = DEFAULT_MANIFEST_PATH
  let upload = true

  for (const arg of argv) {
    const targetValue = parseValueFlag(arg, '--target=')
    if (targetValue !== null) {
      targetArg = targetValue
      continue
    }
    const manifestValue = parseValueFlag(arg, '--manifest=')
    if (manifestValue !== null) {
      manifestPath = manifestValue
      continue
    }
    if (arg === '--no-upload') {
      upload = false
      continue
    }
    if (arg === '--upload') {
      upload = true
      continue
    }
    throw new Error(`Unknown argument: ${arg}`)
  }

  return {
    targets: resolveTargets(targetArg),
    manifestPath,
    upload,
  }
}
