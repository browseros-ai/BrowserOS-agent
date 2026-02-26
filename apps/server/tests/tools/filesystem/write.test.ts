import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { mkdir, readFile, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { FilesystemToolResult } from '../../../src/tools/filesystem/utils'
import { createWriteTool } from '../../../src/tools/filesystem/write'

let tmpDir: string
let exec: (params: Record<string, unknown>) => Promise<FilesystemToolResult>

beforeEach(async () => {
  tmpDir = join(
    tmpdir(),
    `fs-write-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  )
  await mkdir(tmpDir, { recursive: true })
  const tool = createWriteTool(tmpDir)
  exec = (params) => (tool as any).execute(params)
})

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true })
})

describe('filesystem_write', () => {
  it('creates a new file', async () => {
    const result = await exec({ path: 'new.txt', content: 'hello world' })
    expect(result.isError).toBeUndefined()
    expect(result.text).toContain('Wrote')
    expect(result.text).toContain('bytes')

    const content = await readFile(join(tmpDir, 'new.txt'), 'utf-8')
    expect(content).toBe('hello world')
  })

  it('overwrites an existing file', async () => {
    const filePath = join(tmpDir, 'exists.txt')
    await Bun.write(filePath, 'old content')

    const result = await exec({ path: 'exists.txt', content: 'new content' })
    expect(result.isError).toBeUndefined()

    const content = await readFile(filePath, 'utf-8')
    expect(content).toBe('new content')
  })

  it('creates parent directories automatically', async () => {
    const result = await exec({ path: 'a/b/c/deep.txt', content: 'deep' })
    expect(result.isError).toBeUndefined()

    const content = await readFile(join(tmpDir, 'a/b/c/deep.txt'), 'utf-8')
    expect(content).toBe('deep')
  })

  it('writes empty content', async () => {
    const result = await exec({ path: 'empty.txt', content: '' })
    expect(result.isError).toBeUndefined()

    const info = await stat(join(tmpDir, 'empty.txt'))
    expect(info.size).toBe(0)
  })

  it('reports byte count correctly for UTF-8', async () => {
    const content = 'héllo wörld 🌍'
    const result = await exec({ path: 'utf8.txt', content })
    const expectedBytes = Buffer.byteLength(content, 'utf-8')
    expect(result.text).toContain(`${expectedBytes} bytes`)
  })

  it('writes multiline content', async () => {
    const content = 'line 1\nline 2\nline 3'
    await exec({ path: 'multi.txt', content })

    const written = await readFile(join(tmpDir, 'multi.txt'), 'utf-8')
    expect(written).toBe(content)
  })

  it('handles absolute paths', async () => {
    const absPath = join(tmpDir, 'absolute.txt')
    const result = await exec({ path: absPath, content: 'abs content' })
    expect(result.isError).toBeUndefined()

    const content = await readFile(absPath, 'utf-8')
    expect(content).toBe('abs content')
  })
})
