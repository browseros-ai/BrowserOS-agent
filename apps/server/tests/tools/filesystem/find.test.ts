import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { find } from '../../../src/tools/filesystem/find'

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
  cwd = await mkdtemp(join(tmpdir(), 'fs-test-find-'))
  await mkdir(join(cwd, 'src', 'utils'), { recursive: true })
  await Bun.write(join(cwd, 'src', 'main.ts'), 'main')
  await Bun.write(join(cwd, 'src', 'index.ts'), 'index')
  await Bun.write(join(cwd, 'src', 'utils', 'helper.ts'), 'helper')
  await Bun.write(join(cwd, 'readme.md'), 'readme')
  await Bun.write(join(cwd, 'package.json'), '{}')
})

afterEach(async () => {
  await rm(cwd, { recursive: true, force: true })
})

describe('find tool', () => {
  it('finds files by extension glob', async () => {
    const result = await find.execute({ pattern: '*.ts' }, cwd)
    const text = textOf(result)
    expect(text).toContain('main.ts')
    expect(text).toContain('index.ts')
    expect(text).toContain('helper.ts')
    expect(text).not.toContain('readme.md')
  })

  it('finds files with explicit recursive glob', async () => {
    const result = await find.execute({ pattern: '**/*.ts' }, cwd)
    const text = textOf(result)
    expect(text).toContain('main.ts')
    expect(text).toContain('helper.ts')
  })

  it('finds files by exact name', async () => {
    const result = await find.execute({ pattern: 'package.json' }, cwd)
    const text = textOf(result)
    expect(text).toContain('package.json')
    expect(text).not.toContain('main.ts')
  })

  it('returns no results for non-matching pattern', async () => {
    const result = await find.execute({ pattern: '*.xyz' }, cwd)
    expect(textOf(result)).toContain('No files found')
  })

  it('searches in a subdirectory when path specified', async () => {
    const result = await find.execute(
      { pattern: '*.ts', path: 'src/utils' },
      cwd,
    )
    const text = textOf(result)
    expect(text).toContain('helper.ts')
    expect(text).not.toContain('main.ts')
  })

  it('respects result limit', async () => {
    const result = await find.execute({ pattern: '*.ts', limit: 1 }, cwd)
    const text = textOf(result)
    expect(text).toContain('Showing first 1 results')
  })

  it('skips node_modules directory', async () => {
    await mkdir(join(cwd, 'node_modules', 'pkg'), { recursive: true })
    await Bun.write(join(cwd, 'node_modules', 'pkg', 'lib.ts'), 'lib')
    const result = await find.execute({ pattern: '*.ts' }, cwd)
    expect(textOf(result)).not.toContain('node_modules')
  })

  it('returns sorted results', async () => {
    const result = await find.execute({ pattern: '*.ts' }, cwd)
    const text = textOf(result)
    const lines = text.split('\n').filter((l) => l.includes('.ts'))
    const sorted = [...lines].sort()
    expect(lines).toEqual(sorted)
  })

  it('rejects path traversal with ../', async () => {
    const result = await find.execute({ pattern: '*', path: '../../etc' }, cwd)
    expect(result.isError).toBe(true)
    expect(textOf(result)).toContain('Path traversal not allowed')
  })
})
