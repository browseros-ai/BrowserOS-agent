import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { grep } from '../../../src/tools/filesystem/grep'

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
  cwd = await mkdtemp(join(tmpdir(), 'fs-test-grep-'))
  await mkdir(join(cwd, 'src'), { recursive: true })
  await Bun.write(
    join(cwd, 'src', 'main.ts'),
    'const foo = 1\nconst bar = 2\nconst baz = 3\n',
  )
  await Bun.write(
    join(cwd, 'src', 'utils.ts'),
    'export function foo() {}\nexport function bar() {}\n',
  )
  await Bun.write(join(cwd, 'readme.md'), '# Project\nThis is a foo project\n')
})

afterEach(async () => {
  await rm(cwd, { recursive: true, force: true })
})

describe('grep tool', () => {
  it('finds matches across files', async () => {
    const result = await grep.execute({ pattern: 'foo' }, cwd)
    expect(result.isError).toBeUndefined()
    const text = textOf(result)
    expect(text).toContain('foo')
    expect(text).toContain(':')
  })

  it('returns no matches for nonexistent pattern', async () => {
    const result = await grep.execute({ pattern: 'zzzznothere' }, cwd)
    expect(textOf(result)).toContain('No matches found')
  })

  it('supports case-insensitive search', async () => {
    await Bun.write(
      join(cwd, 'case.txt'),
      'Hello World\nhello world\nHELLO WORLD\n',
    )
    const result = await grep.execute(
      { pattern: 'hello', ignore_case: true },
      cwd,
    )
    const text = textOf(result)
    // Should find all three
    expect(text).toContain('Hello World')
    expect(text).toContain('HELLO WORLD')
  })

  it('supports literal string search', async () => {
    await Bun.write(join(cwd, 'regex.txt'), 'price is $10.00\nprice is 10.00\n')
    const result = await grep.execute({ pattern: '$10.00', literal: true }, cwd)
    const text = textOf(result)
    expect(text).toContain('$10.00')
  })

  it('filters by glob pattern', async () => {
    const result = await grep.execute({ pattern: 'foo', glob: '*.ts' }, cwd)
    const text = textOf(result)
    expect(text).toContain('.ts')
    expect(text).not.toContain('readme.md')
  })

  it('supports context lines', async () => {
    await Bun.write(
      join(cwd, 'ctx.txt'),
      'line1\nline2\ntarget\nline4\nline5\n',
    )
    const result = await grep.execute({ pattern: 'target', context: 1 }, cwd)
    const text = textOf(result)
    expect(text).toContain('target')
    expect(text).toContain('line2')
    expect(text).toContain('line4')
  })

  it('respects match limit', async () => {
    const lines = Array.from({ length: 50 }, (_, i) => `match_${i}`)
    await Bun.write(join(cwd, 'many.txt'), lines.join('\n'))
    const result = await grep.execute({ pattern: 'match_', limit: 5 }, cwd)
    const text = textOf(result)
    expect(text).toContain('Reached limit of 5 matches')
  })

  it('returns error for invalid regex', async () => {
    const result = await grep.execute({ pattern: '[invalid' }, cwd)
    expect(result.isError).toBe(true)
    expect(textOf(result)).toContain('Invalid regex')
  })

  it('skips node_modules directory', async () => {
    await mkdir(join(cwd, 'node_modules', 'pkg'), { recursive: true })
    await Bun.write(
      join(cwd, 'node_modules', 'pkg', 'index.js'),
      'const foo = "hidden"',
    )
    const result = await grep.execute({ pattern: 'hidden' }, cwd)
    expect(textOf(result)).toContain('No matches found')
  })

  it('searches in a subdirectory when path is specified', async () => {
    const result = await grep.execute({ pattern: 'const', path: 'src' }, cwd)
    const text = textOf(result)
    expect(text).toContain('const')
    expect(text).not.toContain('readme.md')
  })
})
