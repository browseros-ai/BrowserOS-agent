import { existsSync, realpathSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const UNICODE_SPACES = /[\u00A0\u2000-\u200A\u202F\u205F\u3000]/g

function normalizeUnicodeSpaces(value: string): string {
  return value.replace(UNICODE_SPACES, ' ')
}

function normalizeLeadingAt(value: string): string {
  return value.startsWith('@') ? value.slice(1) : value
}

export function expandPath(rawPath: string): string {
  const normalized = normalizeUnicodeSpaces(normalizeLeadingAt(rawPath))

  if (normalized === '~') return os.homedir()
  if (normalized.startsWith('~/'))
    return path.join(os.homedir(), normalized.slice(2))

  return normalized
}

export function resolvePathInCwd(rawPath: string, cwd: string): string {
  const expanded = expandPath(rawPath)
  if (path.isAbsolute(expanded)) return path.resolve(expanded)
  return path.resolve(cwd, expanded)
}

function resolveRealPathOrFallback(resolvedPath: string): string {
  try {
    return realpathSync.native(resolvedPath)
  } catch {
    return resolvedPath
  }
}

function resolveBoundaryCheckedPath(resolvedPath: string): string {
  const absolutePath = path.resolve(resolvedPath)
  let probe = absolutePath

  while (!existsSync(probe)) {
    const parent = path.dirname(probe)
    if (parent === probe) return absolutePath
    probe = parent
  }

  const realProbe = resolveRealPathOrFallback(probe)
  const remainder = path.relative(probe, absolutePath)
  return path.resolve(realProbe, remainder)
}

export function isPathWithinCwd(resolvedPath: string, cwd: string): boolean {
  const root = resolveBoundaryCheckedPath(path.resolve(cwd))
  const target = resolveBoundaryCheckedPath(path.resolve(resolvedPath))
  const relative = path.relative(root, target)

  return (
    relative === '' ||
    (!relative.startsWith('..') && !path.isAbsolute(relative))
  )
}

export function assertPathWithinCwd(resolvedPath: string, cwd: string): void {
  if (!isPathWithinCwd(resolvedPath, cwd)) {
    throw new Error(`Path is outside the session directory: ${resolvedPath}`)
  }
}

export function toPosixPath(filePath: string): string {
  return filePath.split(path.sep).join('/')
}

export function safeRelativePath(absolutePath: string, cwd: string): string {
  return toPosixPath(path.relative(cwd, absolutePath))
}

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function globToRegExp(pattern: string): RegExp {
  const normalized = toPosixPath(pattern)
  let regex = ''

  for (let i = 0; i < normalized.length; i++) {
    const char = normalized[i]
    const next = normalized[i + 1]

    if (char === '*' && next === '*') {
      regex += '.*'
      i++
      continue
    }

    if (char === '*') {
      regex += '[^/]*'
      continue
    }

    if (char === '?') {
      regex += '[^/]'
      continue
    }

    regex += escapeRegExp(char)
  }

  return new RegExp(`^${regex}$`)
}

export function matchesGlob(pathValue: string, pattern?: string): boolean {
  if (!pattern) return true
  const regex = globToRegExp(pattern)
  return regex.test(toPosixPath(pathValue))
}
