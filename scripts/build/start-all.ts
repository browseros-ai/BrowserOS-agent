#!/usr/bin/env bun
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn, spawnSync } from 'bun'

const MONOREPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..')

const COLORS = {
  server: '\x1b[36m', // cyan
  agent: '\x1b[35m', // magenta
  build: '\x1b[33m', // yellow
  reset: '\x1b[0m',
}

function prefixLines(prefix: string, color: string, text: string): string {
  return text
    .split('\n')
    .filter((line) => line.length > 0)
    .map((line) => `${color}[${prefix}]${COLORS.reset} ${line}`)
    .join('\n')
}

async function streamOutput(
  stream: ReadableStream<Uint8Array>,
  prefix: string,
  color: string,
): Promise<void> {
  const reader = stream.getReader()
  const decoder = new TextDecoder()

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    const text = decoder.decode(value)
    console.log(prefixLines(prefix, color, text))
  }
}

console.log(
  `${COLORS.build}[build]${COLORS.reset} Building controller extension...`,
)
const buildResult = spawnSync({
  cmd: ['bun', 'run', 'build:ext'],
  cwd: MONOREPO_ROOT,
  stdout: 'inherit',
  stderr: 'inherit',
})

if (buildResult.exitCode !== 0) {
  console.error(
    `${COLORS.build}[build]${COLORS.reset} Controller extension build failed`,
  )
  process.exit(1)
}
console.log(
  `${COLORS.build}[build]${COLORS.reset} Controller extension built\n`,
)

console.log(`${COLORS.server}[server]${COLORS.reset} Starting server...`)
console.log(`${COLORS.agent}[agent]${COLORS.reset} Starting agent...\n`)

const serverProc = spawn({
  cmd: ['bun', 'run', '--filter', '@browseros/server', 'start'],
  cwd: MONOREPO_ROOT,
  stdout: 'pipe',
  stderr: 'pipe',
  env: process.env,
})

const agentProc = spawn({
  cmd: ['bun', 'run', '--filter', '@browseros/agent', 'dev'],
  cwd: MONOREPO_ROOT,
  stdout: 'pipe',
  stderr: 'pipe',
  env: process.env,
})

const cleanup = () => {
  serverProc.kill()
  agentProc.kill()
}

process.on('SIGINT', cleanup)
process.on('SIGTERM', cleanup)

await Promise.all([
  streamOutput(serverProc.stdout, 'server', COLORS.server),
  streamOutput(serverProc.stderr, 'server', COLORS.server),
  streamOutput(agentProc.stdout, 'agent', COLORS.agent),
  streamOutput(agentProc.stderr, 'agent', COLORS.agent),
])

const [serverExit, agentExit] = await Promise.all([
  serverProc.exited,
  agentProc.exited,
])

if (serverExit !== 0 || agentExit !== 0) {
  console.error(`\nProcesses exited: server=${serverExit}, agent=${agentExit}`)
  process.exit(1)
}
