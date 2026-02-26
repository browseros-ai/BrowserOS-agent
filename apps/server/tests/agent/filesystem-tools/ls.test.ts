import { afterEach, beforeEach, describe, it } from 'bun:test'
import assert from 'node:assert'
import fs from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { lsTool } from '../../../src/tools/filesystem/ls'

describe('filesystem ls tool', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(tmpdir(), 'browseros-ls-tool-'))
  })

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true })
  })

  it('lists directory entries', async () => {
    fs.mkdirSync(path.join(tempDir, 'alpha'))
    fs.writeFileSync(path.join(tempDir, 'beta.txt'), 'x')

    const result = await lsTool.execute({ path: '.' }, tempDir)
    const text =
      result.content[0]?.type === 'text' ? result.content[0].text : ''

    assert.match(text, /alpha\//)
    assert.match(text, /beta\.txt/)
  })

  it('returns empty-directory message', async () => {
    const result = await lsTool.execute({ path: '.' }, tempDir)
    assert.strictEqual(result.content[0]?.type, 'text')
    assert.strictEqual(result.content[0]?.text, '(empty directory)')
  })

  it('applies entry limit notice', async () => {
    fs.writeFileSync(path.join(tempDir, 'a.txt'), 'a')
    fs.writeFileSync(path.join(tempDir, 'b.txt'), 'b')

    const result = await lsTool.execute({ path: '.', limit: 1 }, tempDir)
    const text =
      result.content[0]?.type === 'text' ? result.content[0].text : ''

    assert.match(text, /1 entries limit reached/)
  })

  it('rejects symlink targets outside session directory', async () => {
    if (process.platform === 'win32') {
      return
    }

    const outsideDir = fs.mkdtempSync(
      path.join(tmpdir(), 'browseros-ls-tool-outside-'),
    )

    try {
      const outsideFile = path.join(outsideDir, 'secret.txt')
      fs.writeFileSync(outsideFile, 'secret')
      fs.symlinkSync(outsideFile, path.join(tempDir, 'escape.txt'))

      await assert.rejects(
        () => lsTool.execute({ path: '.' }, tempDir),
        /outside the session directory/,
      )
    } finally {
      fs.rmSync(outsideDir, { recursive: true, force: true })
    }
  })
})
