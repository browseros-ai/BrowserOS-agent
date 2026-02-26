import { afterEach, beforeEach, describe, it } from 'bun:test'
import assert from 'node:assert'
import fs from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { readTool } from '../../../src/tools/filesystem/read'

describe('filesystem read tool', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(tmpdir(), 'browseros-read-tool-'))
  })

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true })
  })

  it('reads text file with offset and limit', async () => {
    const filePath = path.join(tempDir, 'sample.txt')
    fs.writeFileSync(filePath, 'line1\nline2\nline3\nline4\n')

    const result = await readTool.execute(
      {
        path: 'sample.txt',
        offset: 2,
        limit: 2,
      },
      tempDir,
    )

    const text =
      result.content[0]?.type === 'text' ? result.content[0].text : ''
    assert.match(text, /line2\nline3/)
    assert.match(text, /more lines in file|Use offset=/)
  })

  it('reads image file as media output', async () => {
    const imagePath = path.join(tempDir, 'image.png')
    fs.writeFileSync(imagePath, Buffer.from([0x89, 0x50, 0x4e, 0x47]))

    const result = await readTool.execute({ path: 'image.png' }, tempDir)
    assert.strictEqual(result.content[0]?.type, 'text')
    assert.strictEqual(result.content[1]?.type, 'image')
    if (result.content[1]?.type === 'image') {
      assert.strictEqual(result.content[1].mimeType, 'image/png')
      assert.ok(result.content[1].data.length > 0)
    }
  })

  it('rejects directory reads', async () => {
    const dirPath = path.join(tempDir, 'folder')
    fs.mkdirSync(dirPath)

    await assert.rejects(
      () => readTool.execute({ path: 'folder' }, tempDir),
      /Path is a directory/,
    )
  })

  it('rejects paths outside session directory', async () => {
    const outside = path.join(tempDir, '..', 'outside-read.txt')
    fs.writeFileSync(outside, 'hello')

    await assert.rejects(
      () => readTool.execute({ path: '../outside-read.txt' }, tempDir),
      /outside the session directory/,
    )
  })
})
