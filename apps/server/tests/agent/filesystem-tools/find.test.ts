import { afterEach, beforeEach, describe, it } from 'bun:test'
import assert from 'node:assert'
import fs from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { findTool } from '../../../src/tools/filesystem/find'

describe('filesystem find tool', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(tmpdir(), 'browseros-find-tool-'))
    fs.mkdirSync(path.join(tempDir, 'src'), { recursive: true })
    fs.mkdirSync(path.join(tempDir, 'src/utils'), { recursive: true })
    fs.writeFileSync(path.join(tempDir, 'src/index.ts'), 'export {}\n')
    fs.writeFileSync(path.join(tempDir, 'src/utils/helper.ts'), 'export {}\n')
    fs.writeFileSync(path.join(tempDir, 'README.md'), '# readme\n')
  })

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true })
  })

  it('finds files by glob pattern', async () => {
    const result = await findTool.execute(
      {
        path: '.',
        pattern: '**/*.ts',
      },
      tempDir,
    )

    const text =
      result.content[0]?.type === 'text' ? result.content[0].text : ''
    assert.match(text, /src\/index\.ts/)
    assert.match(text, /src\/utils\/helper\.ts/)
    assert.doesNotMatch(text, /README\.md/)
  })

  it('applies limit notice', async () => {
    const result = await findTool.execute(
      {
        path: '.',
        pattern: '**/*',
        limit: 1,
      },
      tempDir,
    )

    const text =
      result.content[0]?.type === 'text' ? result.content[0].text : ''
    assert.match(text, /1 results limit reached/)
  })

  it('returns no-files message when nothing matches', async () => {
    const result = await findTool.execute(
      {
        path: '.',
        pattern: '**/*.go',
      },
      tempDir,
    )

    assert.strictEqual(result.content[0]?.type, 'text')
    assert.strictEqual(
      result.content[0]?.text,
      'No files found matching pattern',
    )
  })

  it('rejects symlink targets outside session directory', async () => {
    if (process.platform === 'win32') {
      return
    }

    const outsideDir = fs.mkdtempSync(
      path.join(tmpdir(), 'browseros-find-tool-outside-'),
    )

    try {
      const outsideFile = path.join(outsideDir, 'secret.txt')
      fs.writeFileSync(outsideFile, 'secret')
      fs.symlinkSync(outsideFile, path.join(tempDir, 'escape.txt'))

      await assert.rejects(
        () =>
          findTool.execute(
            {
              path: '.',
              pattern: '**/*',
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
