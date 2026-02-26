import { stat } from 'node:fs/promises'
import { resolve } from 'node:path'
import { z } from 'zod'
import type { FilesystemToolDef } from './build-toolset'
import { PathTraversalError, resolveAndAssert } from './path-utils'
import { truncateHead } from './truncate'

const DEFAULT_RESULT_LIMIT = 1000
const SKIP_DIRS = new Set([
  '.git',
  'node_modules',
  '.next',
  'dist',
  '.cache',
  '__pycache__',
])

export const find: FilesystemToolDef = {
  name: 'find',
  description:
    'Search for files by glob pattern. Returns matching file paths relative to the search directory. ' +
    'Output is truncated to 1000 results or 50KB.',
  input: z.object({
    pattern: z
      .string()
      .describe("Glob pattern to match files, e.g. '*.ts', '**/*.json'"),
    path: z
      .string()
      .optional()
      .describe('Directory to search in (default: current directory)'),
    limit: z
      .number()
      .optional()
      .describe('Maximum number of results (default: 1000)'),
  }),
  async execute(args, cwd) {
    let searchPath: string
    try {
      searchPath = args.path ? await resolveAndAssert(args.path, cwd) : cwd
    } catch (e) {
      if (e instanceof PathTraversalError) {
        return {
          content: [{ type: 'text', text: e.message }],
          isError: true,
        }
      }
      throw e
    }
    const limit = args.limit ?? DEFAULT_RESULT_LIMIT

    // Ensure pattern searches recursively if it's a simple extension glob
    const pattern =
      !args.pattern.includes('/') && !args.pattern.startsWith('**')
        ? `**/${args.pattern}`
        : args.pattern

    const glob = new Bun.Glob(pattern)
    const matches: string[] = []

    for await (const filePath of glob.scan({
      cwd: searchPath,
      dot: true,
      onlyFiles: true,
    })) {
      const parts = filePath.split('/')
      if (parts.some((p) => SKIP_DIRS.has(p))) continue

      matches.push(filePath)
      if (matches.length >= limit) break
    }

    if (matches.length === 0) {
      return {
        content: [
          { type: 'text', text: 'No files found matching the pattern.' },
        ],
      }
    }

    // Append trailing / for directories
    const formatted: string[] = []
    for (const m of matches.sort()) {
      try {
        const s = await stat(resolve(searchPath, m))
        formatted.push(s.isDirectory() ? `${m}/` : m)
      } catch {
        formatted.push(m)
      }
    }

    const output = formatted.join('\n')
    const result = truncateHead(output)

    const parts: string[] = []
    if (matches.length >= limit) {
      parts.push(
        `[Showing first ${limit} results. Use a more specific pattern to narrow results.]`,
      )
    } else if (result.truncated) {
      parts.push(
        `[Output truncated — showing first ${result.outputLines} of ${result.totalLines} lines]`,
      )
    }
    parts.push(result.content)

    return { content: [{ type: 'text', text: parts.join('\n') }] }
  },
}
