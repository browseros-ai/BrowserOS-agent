import { readdir, stat } from 'node:fs/promises'
import path from 'node:path'
import { z } from 'zod'
import { assertPathWithinCwd, resolvePathInCwd } from './path-utils'
import { DEFAULT_MAX_BYTES, formatSize, truncateHead } from './truncate'
import type { FilesystemTool } from './types'

const lsInputSchema = z.object({
  path: z
    .string()
    .optional()
    .describe('Directory to list (default: current directory)'),
  limit: z
    .number()
    .int()
    .positive()
    .optional()
    .describe('Maximum number of entries to return (default: 500)'),
})

type LsInput = z.infer<typeof lsInputSchema>

const DEFAULT_LIMIT = 500

export const lsTool: FilesystemTool<LsInput> = {
  name: 'ls',
  description:
    'List directory contents. Returns entries sorted alphabetically, with / suffix for directories.',
  inputSchema: lsInputSchema,
  execute: async ({ path: rawPath, limit }, cwd) => {
    const directoryPath = resolvePathInCwd(rawPath || '.', cwd)
    assertPathWithinCwd(directoryPath, cwd)

    const stats = await stat(directoryPath)
    if (!stats.isDirectory()) {
      throw new Error(`Not a directory: ${rawPath || '.'}`)
    }

    const entries = await readdir(directoryPath, { withFileTypes: true })
    entries.sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
    )

    const effectiveLimit = limit ?? DEFAULT_LIMIT
    const formatted: string[] = []

    for (const entry of entries) {
      if (formatted.length >= effectiveLimit) break
      const fullPath = path.join(directoryPath, entry.name)
      assertPathWithinCwd(fullPath, cwd)
      formatted.push(entry.isDirectory() ? `${entry.name}/` : entry.name)
    }

    if (formatted.length === 0) {
      return { content: [{ type: 'text', text: '(empty directory)' }] }
    }

    const truncation = truncateHead(formatted.join('\n'), {
      maxLines: Number.MAX_SAFE_INTEGER,
      maxBytes: DEFAULT_MAX_BYTES,
    })

    const notices: string[] = []
    if (entries.length > effectiveLimit) {
      notices.push(`${effectiveLimit} entries limit reached`)
    }
    if (truncation.truncated) {
      notices.push(`${formatSize(DEFAULT_MAX_BYTES)} output limit reached`)
    }

    const suffix = notices.length > 0 ? `\n\n[${notices.join('. ')}]` : ''

    return {
      content: [{ type: 'text', text: `${truncation.content}${suffix}` }],
    }
  },
}
