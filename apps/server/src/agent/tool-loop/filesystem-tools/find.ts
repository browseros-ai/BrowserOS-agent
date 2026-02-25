import { stat } from 'node:fs/promises'
import { z } from 'zod'
import {
  assertPathWithinCwd,
  matchesGlob,
  resolvePathInCwd,
  safeRelativePath,
  toPosixPath,
} from './path-utils'
import { walkEntries } from './scan'
import { DEFAULT_MAX_BYTES, formatSize, truncateHead } from './truncate'
import type { FilesystemTool } from './types'

const findInputSchema = z.object({
  pattern: z
    .string()
    .describe(
      'Glob pattern to match files, e.g. *.ts, **/*.json, src/**/*.spec.ts',
    ),
  path: z
    .string()
    .optional()
    .describe('Directory to search in (default: current directory)'),
  limit: z
    .number()
    .int()
    .positive()
    .optional()
    .describe('Maximum number of results to return (default: 1000)'),
})

type FindInput = z.infer<typeof findInputSchema>

const DEFAULT_LIMIT = 1_000

function formatEntry(relativePath: string, isDirectory: boolean): string {
  return isDirectory ? `${relativePath}/` : relativePath
}

export const findTool: FilesystemTool<FindInput> = {
  name: 'find',
  description:
    'Search for files by glob pattern. Returns matching paths relative to the search directory.',
  inputSchema: findInputSchema,
  execute: async ({ pattern, path: rawPath, limit }, cwd) => {
    const searchPath = resolvePathInCwd(rawPath || '.', cwd)
    assertPathWithinCwd(searchPath, cwd)

    const searchStats = await stat(searchPath)
    if (!searchStats.isDirectory()) {
      throw new Error(`Not a directory: ${rawPath || '.'}`)
    }

    const effectiveLimit = limit ?? DEFAULT_LIMIT
    const entries = await walkEntries(searchPath)

    const results: string[] = []
    for (const entry of entries) {
      if (results.length >= effectiveLimit) break

      const relativePath = safeRelativePath(entry.absolutePath, searchPath)
      if (relativePath.length === 0) continue
      if (!matchesGlob(relativePath, pattern)) continue

      results.push(formatEntry(relativePath, entry.isDirectory))
    }

    results.sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: 'base' }),
    )

    if (results.length === 0) {
      return {
        content: [{ type: 'text', text: 'No files found matching pattern' }],
      }
    }

    const baseMessage = results.join('\n')
    const truncation = truncateHead(baseMessage, {
      maxLines: Number.MAX_SAFE_INTEGER,
      maxBytes: DEFAULT_MAX_BYTES,
    })

    const notices: string[] = []
    if (results.length >= effectiveLimit) {
      notices.push(`${effectiveLimit} results limit reached`)
    }
    if (truncation.truncated) {
      notices.push(`${formatSize(DEFAULT_MAX_BYTES)} output limit reached`)
    }

    const scope = toPosixPath(rawPath || '.')
    const header = `Found ${results.length} path(s) in ${scope}:`
    const suffix = notices.length > 0 ? `\n\n[${notices.join('. ')}]` : ''

    return {
      content: [
        { type: 'text', text: `${header}\n${truncation.content}${suffix}` },
      ],
    }
  },
}
