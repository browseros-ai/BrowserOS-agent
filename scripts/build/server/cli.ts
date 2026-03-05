import { resolveTargets } from './targets'
import type { BuildArgs } from './types'

const DEFAULT_MANIFEST_PATH = 'scripts/build/config/server-prod-resources.json'

export function parseBuildArgs(argv: string[]): BuildArgs {
  let targetArg = 'all'
  let manifestPath = DEFAULT_MANIFEST_PATH
  let upload = true

  for (const arg of argv) {
    if (arg.startsWith('--target=')) {
      targetArg = arg.split('=')[1]
      continue
    }
    if (arg.startsWith('--manifest=')) {
      manifestPath = arg.split('=')[1]
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
