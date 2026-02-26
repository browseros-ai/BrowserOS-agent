import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ls } from '../../../src/tools/filesystem/ls'

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
  cwd = await mkdtemp(join(tmpdir(), 'fs-test-ls-'))
  await mkdir(join(cwd, 'subdir'))
  await Bun.write(join(cwd, 'alpha.txt'), 'a')
  await Bun.write(join(cwd, 'beta.txt'), 'b')
  await Bun.write(join(cwd, '.hidden'), 'h')
})

afterEach(async () => {
  await rm(cwd, { recursive: true, force: true })
})

describe('ls tool', () => {
  it('lists directory contents', async () => {
    const result = await ls.execute({}, cwd)
    const text = textOf(result)
    expect(text).toContain('alpha.txt')
    expect(text).toContain('beta.txt')
    expect(text).toContain('subdir/')
  })

  it('appends / to directories', async () => {
    const result = await ls.execute({}, cwd)
    expect(textOf(result)).toContain('subdir/')
  })

  it('includes dotfiles', async () => {
    const result = await ls.execute({}, cwd)
    expect(textOf(result)).toContain('.hidden')
  })

  it('sorts alphabetically (case-insensitive)', async () => {
    const result = await ls.execute({}, cwd)
    const text = textOf(result)
    const lines = text.split('\n').filter(Boolean)
    const sorted = [...lines].sort((a, b) =>
      a.toLowerCase().localeCompare(b.toLowerCase()),
    )
    expect(lines).toEqual(sorted)
  })

  it('lists a subdirectory when path is specified', async () => {
    await Bun.write(join(cwd, 'subdir', 'inner.txt'), 'i')
    const result = await ls.execute({ path: 'subdir' }, cwd)
    const text = textOf(result)
    expect(text).toContain('inner.txt')
    expect(text).not.toContain('alpha.txt')
  })

  it('returns error for nonexistent directory', async () => {
    const result = await ls.execute({ path: 'nope' }, cwd)
    expect(result.isError).toBe(true)
    expect(textOf(result)).toContain('Cannot read directory')
  })

  it('handles empty directory', async () => {
    await mkdir(join(cwd, 'empty'))
    const result = await ls.execute({ path: 'empty' }, cwd)
    expect(textOf(result)).toContain('Directory is empty')
  })

  it('respects entry limit', async () => {
    for (let i = 0; i < 10; i++) {
      await Bun.write(join(cwd, `file_${i}.txt`), '')
    }
    const result = await ls.execute({ limit: 3 }, cwd)
    const text = textOf(result)
    expect(text).toContain('Showing first 3 of')
  })

  it('rejects path traversal with ../', async () => {
    const result = await ls.execute({ path: '../../etc' }, cwd)
    expect(result.isError).toBe(true)
    expect(textOf(result)).toContain('Path traversal not allowed')
  })
})
