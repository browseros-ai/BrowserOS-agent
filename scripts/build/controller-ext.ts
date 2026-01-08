import { execSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const MONOREPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..')

console.log('Building controller extension...')
execSync('bun run build:ext', { cwd: MONOREPO_ROOT, stdio: 'inherit' })
