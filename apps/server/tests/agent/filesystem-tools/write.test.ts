import { afterEach, beforeEach, describe, it } from 'bun:test'
import assert from 'node:assert'
import fs from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { writeTool } from '../../../src/tools/filesystem/write'

describe('filesystem write tool', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(tmpdir(), 'browseros-write-tool-'))
  })

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true })
  })

  it('writes content and creates parent directories', async () => {
    const result = await writeTool.execute(
      {
        path: 'nested/deep/file.txt',
        content: 'hello world',
      },
      tempDir,
    )

    const content = fs.readFileSync(
      path.join(tempDir, 'nested/deep/file.txt'),
      'utf-8',
    )

    assert.strictEqual(content, 'hello world')
    assert.match(
      result.content[0]?.type === 'text' ? result.content[0].text : '',
      /Successfully wrote/,
    )
  })

  it('rejects paths outside session directory', async () => {
    await assert.rejects(
      () =>
        writeTool.execute(
          {
            path: '../outside-write.txt',
            content: 'bad',
          },
          tempDir,
        ),
      /outside the session directory/,
    )
  })
})
