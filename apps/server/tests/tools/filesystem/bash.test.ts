import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { bash } from '../../../src/tools/filesystem/bash'

function textOf(result: {
  content: { type: string; text?: string }[]
}): string {
  return result.content
    .filter((c) => c.type === 'text')
    .map((c) => c.text)
    .join('\n')
}

let cwd: string

beforeEach(async () => {
  cwd = await mkdtemp(join(tmpdir(), 'fs-test-bash-'))
})

afterEach(async () => {
  await rm(cwd, { recursive: true, force: true })
})

const isWindows = process.platform === 'win32'
const echoCmd = isWindows ? 'Write-Output "hello"' : 'echo hello'
const pwdCmd = isWindows
  ? 'Get-Location | Select-Object -ExpandProperty Path'
  : 'pwd'
const failCmd = isWindows ? 'exit 1' : 'exit 1'
const stderrCmd = isWindows ? 'Write-Error "oops" 2>&1' : 'echo oops >&2'

describe('bash tool', () => {
  it('executes a simple command', async () => {
    const result = await bash.execute({ command: echoCmd }, cwd)
    expect(result.isError).toBeUndefined()
    expect(textOf(result)).toContain('hello')
  })

  it('runs in the correct working directory', async () => {
    const result = await bash.execute({ command: pwdCmd }, cwd)
    expect(result.isError).toBeUndefined()
    expect(textOf(result)).toContain(cwd)
  })

  it('reports non-zero exit code as error', async () => {
    const result = await bash.execute({ command: failCmd }, cwd)
    expect(result.isError).toBe(true)
    expect(textOf(result)).toContain('Exit code:')
  })

  it('captures stderr', async () => {
    const result = await bash.execute({ command: stderrCmd }, cwd)
    const text = textOf(result)
    expect(text).toContain('oops')
  })

  it('respects timeout', async () => {
    const sleepCmd = isWindows ? 'Start-Sleep -Seconds 30' : 'sleep 30'
    const result = await bash.execute({ command: sleepCmd, timeout: 1 }, cwd)
    expect(result.isError).toBe(true)
  }, 10_000)

  it('returns success message for no-output commands', async () => {
    const noopCmd = isWindows ? '$null' : 'true'
    const result = await bash.execute({ command: noopCmd }, cwd)
    expect(result.isError).toBeUndefined()
    expect(textOf(result).length).toBeGreaterThan(0)
  })

  it('handles multiline output', async () => {
    const cmd = isWindows
      ? 'Write-Output "line1"; Write-Output "line2"; Write-Output "line3"'
      : 'echo line1; echo line2; echo line3'
    const result = await bash.execute({ command: cmd }, cwd)
    const text = textOf(result)
    expect(text).toContain('line1')
    expect(text).toContain('line2')
    expect(text).toContain('line3')
  })
})
