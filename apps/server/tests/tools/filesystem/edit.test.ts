import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { edit } from '../../../src/tools/filesystem/edit'

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
  cwd = await mkdtemp(join(tmpdir(), 'fs-test-edit-'))
})

afterEach(async () => {
  await rm(cwd, { recursive: true, force: true })
})

describe('edit tool', () => {
  it('replaces text in a file', async () => {
    await Bun.write(join(cwd, 'file.txt'), 'hello world')
    const result = await edit.execute(
      { path: 'file.txt', old_text: 'hello', new_text: 'goodbye' },
      cwd,
    )
    expect(result.isError).toBeUndefined()
    expect(textOf(result)).toContain('Edited')

    const content = await Bun.file(join(cwd, 'file.txt')).text()
    expect(content).toBe('goodbye world')
  })

  it('handles multiline replacements', async () => {
    await Bun.write(join(cwd, 'multi.txt'), 'line1\nline2\nline3\nline4')
    const result = await edit.execute(
      {
        path: 'multi.txt',
        old_text: 'line2\nline3',
        new_text: 'replaced2\nreplaced3',
      },
      cwd,
    )
    expect(result.isError).toBeUndefined()

    const content = await Bun.file(join(cwd, 'multi.txt')).text()
    expect(content).toBe('line1\nreplaced2\nreplaced3\nline4')
  })

  it('returns error when text not found', async () => {
    await Bun.write(join(cwd, 'file.txt'), 'hello world')
    const result = await edit.execute(
      { path: 'file.txt', old_text: 'not here', new_text: 'nope' },
      cwd,
    )
    expect(result.isError).toBe(true)
    expect(textOf(result)).toContain('Text not found')
  })

  it('returns error when multiple occurrences found', async () => {
    await Bun.write(join(cwd, 'file.txt'), 'foo bar foo')
    const result = await edit.execute(
      { path: 'file.txt', old_text: 'foo', new_text: 'baz' },
      cwd,
    )
    expect(result.isError).toBe(true)
    expect(textOf(result)).toContain('2 occurrences')
  })

  it('returns error when old_text equals new_text', async () => {
    await Bun.write(join(cwd, 'file.txt'), 'hello world')
    const result = await edit.execute(
      { path: 'file.txt', old_text: 'hello', new_text: 'hello' },
      cwd,
    )
    expect(result.isError).toBe(true)
    expect(textOf(result)).toContain('identical')
  })

  it('returns error for missing file', async () => {
    const result = await edit.execute(
      { path: 'nope.txt', old_text: 'a', new_text: 'b' },
      cwd,
    )
    expect(result.isError).toBe(true)
    expect(textOf(result)).toContain('File not found')
  })

  it('preserves CRLF line endings', async () => {
    await Bun.write(join(cwd, 'crlf.txt'), 'line1\r\nline2\r\nline3')
    const result = await edit.execute(
      { path: 'crlf.txt', old_text: 'line2', new_text: 'replaced' },
      cwd,
    )
    expect(result.isError).toBeUndefined()

    const raw = await Bun.file(join(cwd, 'crlf.txt')).text()
    expect(raw).toBe('line1\r\nreplaced\r\nline3')
  })

  it('matches across CRLF boundaries when old_text uses LF', async () => {
    await Bun.write(join(cwd, 'crlf2.txt'), 'aaa\r\nbbb\r\nccc')
    const result = await edit.execute(
      { path: 'crlf2.txt', old_text: 'aaa\nbbb', new_text: 'xxx\nyyy' },
      cwd,
    )
    expect(result.isError).toBeUndefined()

    const raw = await Bun.file(join(cwd, 'crlf2.txt')).text()
    expect(raw).toBe('xxx\r\nyyy\r\nccc')
  })

  it('reports correct line number of change', async () => {
    await Bun.write(join(cwd, 'lines.txt'), 'a\nb\nc\ntarget\ne')
    const result = await edit.execute(
      { path: 'lines.txt', old_text: 'target', new_text: 'replaced' },
      cwd,
    )
    expect(textOf(result)).toContain('line 4')
  })

  it('preserves BOM in UTF-8 files', async () => {
    const BOM_BYTES = new Uint8Array([0xef, 0xbb, 0xbf])
    const content = new TextEncoder().encode('hello world')
    const withBom = new Uint8Array([...BOM_BYTES, ...content])
    await Bun.write(join(cwd, 'bom.txt'), withBom)

    const result = await edit.execute(
      { path: 'bom.txt', old_text: 'hello', new_text: 'goodbye' },
      cwd,
    )
    expect(result.isError).toBeUndefined()

    const rawBytes = new Uint8Array(
      await Bun.file(join(cwd, 'bom.txt')).arrayBuffer(),
    )
    expect(rawBytes[0]).toBe(0xef)
    expect(rawBytes[1]).toBe(0xbb)
    expect(rawBytes[2]).toBe(0xbf)
    const textAfterBom = new TextDecoder().decode(rawBytes.slice(3))
    expect(textAfterBom).toBe('goodbye world')
  })

  it('rejects path traversal with ../', async () => {
    const result = await edit.execute(
      { path: '../../etc/passwd', old_text: 'a', new_text: 'b' },
      cwd,
    )
    expect(result.isError).toBe(true)
    expect(textOf(result)).toContain('Path traversal not allowed')
  })
})
