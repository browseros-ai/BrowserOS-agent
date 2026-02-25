import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { read } from '../../../src/tools/filesystem/read'

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
  cwd = await mkdtemp(join(tmpdir(), 'fs-test-read-'))
})

afterEach(async () => {
  await rm(cwd, { recursive: true, force: true })
})

describe('read tool', () => {
  it('reads a text file', async () => {
    await Bun.write(join(cwd, 'hello.txt'), 'Hello, world!\nSecond line')
    const result = await read.execute({ path: 'hello.txt' }, cwd)
    expect(result.isError).toBeUndefined()
    expect(textOf(result)).toContain('Hello, world!')
    expect(textOf(result)).toContain('Second line')
  })

  it('returns error for missing file', async () => {
    const result = await read.execute({ path: 'nope.txt' }, cwd)
    expect(result.isError).toBe(true)
    expect(textOf(result)).toContain('File not found')
  })

  it('supports offset parameter (1-indexed)', async () => {
    const lines = Array.from({ length: 10 }, (_, i) => `line ${i + 1}`)
    await Bun.write(join(cwd, 'lines.txt'), lines.join('\n'))

    const result = await read.execute({ path: 'lines.txt', offset: 5 }, cwd)
    const text = textOf(result)
    expect(text).toContain('line 5')
    expect(text).not.toContain('line 4')
    expect(text).toContain('[Showing lines 5-')
  })

  it('supports limit parameter', async () => {
    const lines = Array.from({ length: 10 }, (_, i) => `line ${i + 1}`)
    await Bun.write(join(cwd, 'lines.txt'), lines.join('\n'))

    const result = await read.execute({ path: 'lines.txt', limit: 3 }, cwd)
    const text = textOf(result)
    expect(text).toContain('line 1')
    expect(text).toContain('line 3')
    expect(text).not.toContain('line 4')
  })

  it('supports offset + limit together', async () => {
    const lines = Array.from({ length: 10 }, (_, i) => `line ${i + 1}`)
    await Bun.write(join(cwd, 'lines.txt'), lines.join('\n'))

    const result = await read.execute(
      { path: 'lines.txt', offset: 3, limit: 2 },
      cwd,
    )
    const text = textOf(result)
    expect(text).toContain('line 3')
    expect(text).toContain('line 4')
    expect(text).not.toContain('line 5')
    expect(text).toContain('[Showing lines 3-4 of')
  })

  it('reads an image file as base64', async () => {
    // 1x1 red PNG
    const pngBytes = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
      'base64',
    )
    await Bun.write(join(cwd, 'pixel.png'), pngBytes)

    const result = await read.execute({ path: 'pixel.png' }, cwd)
    expect(result.isError).toBeUndefined()
    const imageItem = result.content.find(
      (c): c is { type: 'image'; data: string; mimeType: string } =>
        c.type === 'image',
    )
    expect(imageItem).toBeDefined()
    expect(imageItem?.mimeType).toBe('image/png')
    expect(imageItem?.data.length).toBeGreaterThan(0)
  })

  it('handles empty file', async () => {
    await Bun.write(join(cwd, 'empty.txt'), '')
    const result = await read.execute({ path: 'empty.txt' }, cwd)
    expect(result.isError).toBeUndefined()
  })

  it('reads with absolute path', async () => {
    const absPath = join(cwd, 'abs.txt')
    await Bun.write(absPath, 'absolute content')
    const result = await read.execute({ path: absPath }, cwd)
    expect(textOf(result)).toContain('absolute content')
  })
})
