#!/usr/bin/env bun
import { mkdtempSync, rmSync } from 'node:fs'
import { createServer as createNetServer } from 'node:net'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn, spawnSync } from 'bun'
import { DEV_PORTS } from '../../packages/shared/src/constants/ports'

type MutablePorts = { cdp: number; server: number; extension: number }

const DEFAULT_USER_DATA_DIR = '/tmp/browseros-dev'

const MONOREPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..')

const COLORS = {
  server: '\x1b[36m',
  agent: '\x1b[35m',
  build: '\x1b[33m',
  ports: '\x1b[32m',
  reset: '\x1b[0m',
}

function log(prefix: string, color: string, message: string): void {
  console.log(`${color}[${prefix}]${COLORS.reset} ${message}`)
}

function printHelp(): void {
  console.log(`
Usage: bun run start:dev [options]

Starts the BrowserOS server and agent in parallel.

Options:
  --new     Use new available ports and a fresh temp data directory
            (cleaned up on exit)
  --help    Show this help message

Default behavior kills processes on dev ports (${DEV_PORTS.cdp}, ${DEV_PORTS.server}, ${DEV_PORTS.extension})
before starting.
`)
}

function parseArgs(): { isNew: boolean; help: boolean } {
  return {
    isNew: process.argv.includes('--new'),
    help: process.argv.includes('--help') || process.argv.includes('-h'),
  }
}

function killPort(port: number): void {
  spawnSync({
    cmd: ['sh', '-c', `lsof -ti:${port} | xargs kill -9 2>/dev/null || true`],
  })
}

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createNetServer()
    server.once('error', () => resolve(false))
    server.once('listening', () => {
      server.close()
      resolve(true)
    })
    server.listen(port, '127.0.0.1')
  })
}

async function findAvailablePort(startPort: number): Promise<number> {
  let port = startPort
  while (!(await isPortAvailable(port))) {
    port++
  }
  return port
}

async function findAvailableMutablePorts(
  start: MutablePorts,
): Promise<MutablePorts> {
  const cdp = await findAvailablePort(start.cdp)
  const server = await findAvailablePort(start.server)
  const extension = await findAvailablePort(start.extension)
  return { cdp, server, extension }
}

function killAllMutablePorts(ports: MutablePorts): void {
  log(
    'ports',
    COLORS.ports,
    `Killing processes on ports ${ports.cdp}, ${ports.server}, ${ports.extension}...`,
  )
  killPort(ports.cdp)
  killPort(ports.server)
  killPort(ports.extension)
  log('ports', COLORS.ports, 'MutablePorts cleared')
}

function createEnvWithMutablePorts(
  ports: MutablePorts,
  userDataDir: string,
): NodeJS.ProcessEnv {
  return {
    ...process.env,
    NODE_ENV: 'development',
    BROWSEROS_CDP_PORT: String(ports.cdp),
    BROWSEROS_SERVER_PORT: String(ports.server),
    BROWSEROS_EXTENSION_PORT: String(ports.extension),
    VITE_BROWSEROS_SERVER_PORT: String(ports.server),
    BROWSEROS_USER_DATA_DIR: userDataDir,
  }
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

async function main() {
  const args = parseArgs()

  if (args.help) {
    printHelp()
    process.exit(0)
  }

  let ports = { ...DEV_PORTS }
  let userDataDir = DEFAULT_USER_DATA_DIR
  let tempDir: string | null = null

  if (args.isNew) {
    log('ports', COLORS.ports, 'Finding available ports...')
    ports = await findAvailableMutablePorts(DEV_PORTS)

    if (
      ports.cdp !== DEV_PORTS.cdp ||
      ports.server !== DEV_PORTS.server ||
      ports.extension !== DEV_PORTS.extension
    ) {
      log('ports', COLORS.ports, 'Using new ports:')
      console.log(`  CDP:       ${ports.cdp}`)
      console.log(`  Server:    ${ports.server}`)
      console.log(`  Extension: ${ports.extension}`)
    } else {
      log('ports', COLORS.ports, 'Default ports are available')
    }

    tempDir = mkdtempSync('/tmp/browseros-dev-')
    userDataDir = tempDir
    log('ports', COLORS.ports, `Using temp user data dir: ${tempDir}`)
  } else {
    killAllMutablePorts(ports)
  }

  log('build', COLORS.build, 'Building controller extension...')
  const buildResult = spawnSync({
    cmd: ['bun', 'run', 'build:ext'],
    cwd: MONOREPO_ROOT,
    stdout: 'inherit',
    stderr: 'inherit',
  })

  if (buildResult.exitCode !== 0) {
    log('build', COLORS.build, 'Controller extension build failed')
    process.exit(1)
  }
  log('build', COLORS.build, 'Controller extension built\n')

  const env = createEnvWithMutablePorts(ports, userDataDir)

  log('server', COLORS.server, 'Starting server...')
  log('agent', COLORS.agent, 'Starting agent...\n')

  const serverProc = spawn({
    cmd: ['bun', 'run', '--filter', '@browseros/server', 'start'],
    cwd: MONOREPO_ROOT,
    stdout: 'pipe',
    stderr: 'pipe',
    env,
  })

  const agentProc = spawn({
    cmd: ['bun', 'run', '--filter', '@browseros/agent', 'dev'],
    cwd: MONOREPO_ROOT,
    stdout: 'pipe',
    stderr: 'pipe',
    env,
  })

  const cleanup = () => {
    serverProc.kill()
    agentProc.kill()
    if (tempDir) {
      log('ports', COLORS.ports, `Cleaning up temp dir: ${tempDir}`)
      rmSync(tempDir, { recursive: true, force: true })
    }
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
    console.error(
      `\nProcesses exited: server=${serverExit}, agent=${agentExit}`,
    )
    process.exit(1)
  }
}

main()
