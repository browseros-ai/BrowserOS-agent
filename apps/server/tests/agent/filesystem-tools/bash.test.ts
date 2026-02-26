import { afterEach, beforeEach, describe, it } from 'bun:test'
import assert from 'node:assert'
import fs from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { bashTool } from '../../../src/tools/filesystem/bash'

describe('filesystem bash tool', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(tmpdir(), 'browseros-bash-tool-'))
  })

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true })
  })

  it('executes command and returns output', async () => {
    const result = await bashTool.execute(
      { command: "printf 'hello'" },
      tempDir,
    )
    const text =
      result.content[0]?.type === 'text' ? result.content[0].text : ''
    assert.strictEqual(text, 'hello')
  })

  it('throws when command exits with non-zero status', async () => {
    await assert.rejects(
      () => bashTool.execute({ command: 'exit 7' }, tempDir),
      /Command exited with code 7/,
    )
  })

  it('times out long-running command', async () => {
    if (process.platform === 'win32') {
      return
    }

    await assert.rejects(
      () =>
        bashTool.execute(
          {
            command: 'sleep 2',
            timeout: 0.1,
          },
          tempDir,
        ),
      /timed out/,
    )
  })
})
