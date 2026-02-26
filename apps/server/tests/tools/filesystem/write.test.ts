import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { write } from '../../../src/tools/filesystem/write'

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
  cwd = await mkdtemp(join(tmpdir(), 'fs-test-write-'))
})

afterEach(async () => {
  await rm(cwd, { recursive: true, force: true })
})

describe('write tool', () => {
  it('creates a new file', async () => {
    const result = await write.execute(
      { path: 'new.txt', content: 'hello' },
      cwd,
    )
    expect(result.isError).toBeUndefined()
    expect(textOf(result)).toContain('Wrote')
    expect(textOf(result)).toContain('5 bytes')

    const content = await Bun.file(join(cwd, 'new.txt')).text()
    expect(content).toBe('hello')
  })

  it('overwrites an existing file', async () => {
    await Bun.write(join(cwd, 'existing.txt'), 'old content')
    const result = await write.execute(
      { path: 'existing.txt', content: 'new content' },
      cwd,
    )
    expect(result.isError).toBeUndefined()

    const content = await Bun.file(join(cwd, 'existing.txt')).text()
    expect(content).toBe('new content')
  })

  it('creates parent directories automatically', async () => {
    const result = await write.execute(
      { path: 'deep/nested/dir/file.txt', content: 'deep content' },
      cwd,
    )
    expect(result.isError).toBeUndefined()

    const content = await Bun.file(join(cwd, 'deep/nested/dir/file.txt')).text()
    expect(content).toBe('deep content')
  })

  it('handles empty content', async () => {
    const result = await write.execute({ path: 'empty.txt', content: '' }, cwd)
    expect(result.isError).toBeUndefined()
    expect(textOf(result)).toContain('0 bytes')

    const content = await Bun.file(join(cwd, 'empty.txt')).text()
    expect(content).toBe('')
  })

  it('handles unicode content', async () => {
    const unicode = '你好世界 🌍 café'
    const result = await write.execute(
      { path: 'unicode.txt', content: unicode },
      cwd,
    )
    expect(result.isError).toBeUndefined()

    const content = await Bun.file(join(cwd, 'unicode.txt')).text()
    expect(content).toBe(unicode)
  })

  it('rejects path traversal with ../', async () => {
    const result = await write.execute(
      { path: '../../etc/evil.txt', content: 'pwned' },
      cwd,
    )
    expect(result.isError).toBe(true)
    expect(textOf(result)).toContain('Path traversal not allowed')
  })
})
