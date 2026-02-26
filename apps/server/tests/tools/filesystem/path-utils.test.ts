import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { mkdir, mkdtemp, rm, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  PathTraversalError,
  resolveAndAssert,
} from '../../../src/tools/filesystem/path-utils'

let cwd: string

beforeEach(async () => {
  cwd = await mkdtemp(join(tmpdir(), 'fs-test-pathutils-'))
})

afterEach(async () => {
  await rm(cwd, { recursive: true, force: true })
})

describe('resolveAndAssert', () => {
  it('resolves a file within cwd', async () => {
    await Bun.write(join(cwd, 'file.txt'), 'hello')
    const result = await resolveAndAssert('file.txt', cwd)
    expect(result).toContain('file.txt')
  })

  it('resolves a subdirectory path', async () => {
    await mkdir(join(cwd, 'sub'))
    await Bun.write(join(cwd, 'sub', 'nested.txt'), 'nested')
    const result = await resolveAndAssert('sub/nested.txt', cwd)
    expect(result).toContain('nested.txt')
  })

  it('allows non-existent file in existing parent', async () => {
    const result = await resolveAndAssert('newfile.txt', cwd)
    expect(result).toContain('newfile.txt')
  })

  it('rejects path traversal with ../', async () => {
    expect(resolveAndAssert('../../etc/passwd', cwd)).rejects.toThrow(
      PathTraversalError,
    )
  })

  it('rejects absolute path outside cwd', async () => {
    expect(resolveAndAssert('/etc/passwd', cwd)).rejects.toThrow(
      PathTraversalError,
    )
  })

  it('rejects symlink that escapes cwd', async () => {
    await symlink('/tmp', join(cwd, 'escape-link'))
    expect(resolveAndAssert('escape-link/somefile', cwd)).rejects.toThrow(
      PathTraversalError,
    )
  })

  it('allows symlink within cwd', async () => {
    await mkdir(join(cwd, 'real'))
    await Bun.write(join(cwd, 'real', 'data.txt'), 'data')
    await symlink(join(cwd, 'real'), join(cwd, 'link'))
    const result = await resolveAndAssert('link/data.txt', cwd)
    expect(result).toContain('data.txt')
  })
})
