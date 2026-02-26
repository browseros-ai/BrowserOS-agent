import { realpath } from 'node:fs/promises'
import { basename, resolve } from 'node:path'

export async function resolveAndAssert(
  rawPath: string,
  cwd: string,
): Promise<string> {
  const resolved = resolve(cwd, rawPath)

  let realCwd: string
  try {
    realCwd = await realpath(cwd)
  } catch {
    realCwd = cwd
  }

  // File exists — use its real path for the check
  let realResolved: string
  try {
    realResolved = await realpath(resolved)
  } catch {
    // File doesn't exist yet (write creating a new file).
    // Validate the parent directory instead.
    const parent = resolve(resolved, '..')
    try {
      const realParent = await realpath(parent)
      if (!realParent.startsWith(realCwd) && realParent !== realCwd) {
        throw new PathTraversalError(rawPath)
      }
      // Parent is valid — return the resolved path under the real parent
      return resolve(realParent, basename(resolved))
    } catch (e) {
      if (e instanceof PathTraversalError) throw e
      // Parent doesn't exist — fall through to structural check
    }

    // Neither file nor parent exist. Use structural comparison
    // with the real cwd to catch obvious traversal like ../../etc/passwd
    const resolvedFromReal = resolve(realCwd, rawPath)
    if (!resolvedFromReal.startsWith(realCwd)) {
      throw new PathTraversalError(rawPath)
    }
    return resolvedFromReal
  }

  if (!realResolved.startsWith(realCwd) && realResolved !== realCwd) {
    throw new PathTraversalError(rawPath)
  }

  return realResolved
}

export class PathTraversalError extends Error {
  constructor(path: string) {
    super(`Path traversal not allowed: ${path}`)
    this.name = 'PathTraversalError'
  }
}
