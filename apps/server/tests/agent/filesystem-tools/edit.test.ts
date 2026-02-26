import { afterEach, beforeEach, describe, it } from 'bun:test'
import assert from 'node:assert'
import fs from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { editTool } from '../../../src/tools/filesystem/edit'

describe('filesystem edit tool', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(tmpdir(), 'browseros-edit-tool-'))
  })

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true })
  })

  it('replaces unique text in a file', async () => {
    const filePath = path.join(tempDir, 'sample.txt')
    fs.writeFileSync(filePath, 'hello old world\n')

    const result = await editTool.execute(
      {
        path: 'sample.txt',
        oldText: 'old',
        newText: 'new',
      },
      tempDir,
    )

    const updated = fs.readFileSync(filePath, 'utf-8')
    assert.strictEqual(updated, 'hello new world\n')
    assert.match(result.content[0]?.text || '', /Successfully replaced text/)
  })

  it('fails when oldText is not unique', async () => {
    const filePath = path.join(tempDir, 'sample.txt')
    fs.writeFileSync(filePath, 'old\nold\n')

    await assert.rejects(
      () =>
        editTool.execute(
          {
            path: 'sample.txt',
            oldText: 'old',
            newText: 'new',
          },
          tempDir,
        ),
      /must be unique/,
    )
  })

  it('rejects paths outside session directory', async () => {
    const outsidePath = path.join(tempDir, '..', 'outside.txt')
    fs.writeFileSync(outsidePath, 'value')

    await assert.rejects(
      () =>
        editTool.execute(
          {
            path: '../outside.txt',
            oldText: 'value',
            newText: 'changed',
          },
          tempDir,
        ),
      /outside the session directory/,
    )
  })

  it('rejects symlink targets outside session directory', async () => {
    if (process.platform === 'win32') {
      return
    }

    const outsideDir = fs.mkdtempSync(
      path.join(tmpdir(), 'browseros-edit-tool-outside-'),
    )

    try {
      const outsideFile = path.join(outsideDir, 'secret.txt')
      fs.writeFileSync(outsideFile, 'value')
      fs.symlinkSync(outsideFile, path.join(tempDir, 'escape.txt'))

      await assert.rejects(
        () =>
          editTool.execute(
            {
              path: 'escape.txt',
              oldText: 'value',
              newText: 'changed',
            },
            tempDir,
          ),
        /outside the session directory/,
      )
    } finally {
      fs.rmSync(outsideDir, { recursive: true, force: true })
    }
  })
})
