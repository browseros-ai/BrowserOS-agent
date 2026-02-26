import { afterEach, beforeEach, describe, it } from 'bun:test'
import assert from 'node:assert'
import fs from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { grepTool } from '../../../src/tools/filesystem/grep'

describe('filesystem grep tool', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(tmpdir(), 'browseros-grep-tool-'))
    fs.writeFileSync(path.join(tempDir, 'a.ts'), 'const x = 1 // TODO\n')
    fs.writeFileSync(path.join(tempDir, 'b.ts'), 'TODO: second\nline2\n')
    fs.writeFileSync(path.join(tempDir, 'note.txt'), 'TODO in txt\n')
  })

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true })
  })

  it('finds matches and respects glob filtering', async () => {
    const result = await grepTool.execute(
      {
        path: '.',
        pattern: 'TODO',
        literal: true,
        glob: '*.ts',
      },
      tempDir,
    )

    const text =
      result.content[0]?.type === 'text' ? result.content[0].text : ''
    assert.match(text, /a\.ts:1:/)
    assert.match(text, /b\.ts:1:/)
    assert.doesNotMatch(text, /note\.txt/)
  })

  it('applies result limit notice', async () => {
    const result = await grepTool.execute(
      {
        path: '.',
        pattern: 'TODO',
        literal: true,
        limit: 1,
      },
      tempDir,
    )

    const text =
      result.content[0]?.type === 'text' ? result.content[0].text : ''
    assert.match(text, /1 results limit reached/)
  })

  it('returns no-match message when nothing matches', async () => {
    const result = await grepTool.execute(
      {
        path: '.',
        pattern: 'SHOULD_NOT_MATCH',
      },
      tempDir,
    )

    assert.strictEqual(result.content[0]?.type, 'text')
    assert.strictEqual(result.content[0]?.text, 'No matches found for pattern')
  })

  it('rejects symlink targets outside session directory', async () => {
    if (process.platform === 'win32') {
      return
    }

    const outsideDir = fs.mkdtempSync(
      path.join(tmpdir(), 'browseros-grep-tool-outside-'),
    )

    try {
      const outsideFile = path.join(outsideDir, 'secret.txt')
      fs.writeFileSync(outsideFile, 'TODO from outside\n')
      fs.symlinkSync(outsideFile, path.join(tempDir, 'escape.txt'))

      await assert.rejects(
        () =>
          grepTool.execute(
            {
              path: '.',
              pattern: 'TODO',
              literal: true,
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
