import { describe, it } from 'bun:test'
import assert from 'node:assert'
import path from 'node:path'
import {
  assertPathWithinCwd,
  matchesGlob,
  resolvePathInCwd,
  safeRelativePath,
} from '../../../src/agent/tool-loop/filesystem-tools/path-utils'

describe('filesystem path utils', () => {
  it('resolves relative paths inside cwd', () => {
    const cwd = '/tmp/workspace'
    const resolved = resolvePathInCwd('src/index.ts', cwd)

    assert.strictEqual(resolved, path.resolve('/tmp/workspace/src/index.ts'))
    assert.doesNotThrow(() => assertPathWithinCwd(resolved, cwd))
  })

  it('rejects traversal outside cwd', () => {
    const cwd = '/tmp/workspace'
    const outside = resolvePathInCwd('../etc/passwd', cwd)

    assert.throws(() => assertPathWithinCwd(outside, cwd), {
      message: /outside the session directory/,
    })
  })

  it('matches basic glob patterns', () => {
    assert.strictEqual(matchesGlob('src/app.ts', 'src/*.ts'), true)
    assert.strictEqual(matchesGlob('src/utils/app.ts', 'src/*.ts'), false)
    assert.strictEqual(matchesGlob('src/utils/app.ts', 'src/**/*.ts'), true)
  })

  it('builds safe relative posix paths', () => {
    const relative = safeRelativePath(
      '/tmp/workspace/src/a.ts',
      '/tmp/workspace',
    )
    assert.strictEqual(relative, 'src/a.ts')
  })
})
