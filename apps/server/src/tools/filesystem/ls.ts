import { readdir } from 'node:fs/promises'
import { z } from 'zod'
import type { FilesystemToolDef } from './build-toolset'
import { PathTraversalError, resolveAndAssert } from './path-utils'
import { truncateHead } from './truncate'

const DEFAULT_ENTRY_LIMIT = 500

export const ls: FilesystemToolDef = {
  name: 'ls',
  description:
    'List directory contents. Returns entries sorted alphabetically with "/" suffix for directories. ' +
    'Includes dotfiles. Output is truncated to 500 entries or 50KB.',
  input: z.object({
    path: z
      .string()
      .optional()
      .describe('Directory to list (default: current directory)'),
    limit: z
      .number()
      .optional()
      .describe('Maximum number of entries to return (default: 500)'),
  }),
  async execute(args, cwd) {
    let dirPath: string
    try {
      dirPath = args.path ? await resolveAndAssert(args.path, cwd) : cwd
    } catch (e) {
      if (e instanceof PathTraversalError) {
        return {
          content: [{ type: 'text', text: e.message }],
          isError: true,
        }
      }
      throw e
    }

    const limit = args.limit ?? DEFAULT_ENTRY_LIMIT

    let dirents: import('node:fs').Dirent[]
    try {
      dirents = await readdir(dirPath, { withFileTypes: true })
    } catch {
      return {
        content: [
          { type: 'text', text: `Cannot read directory: ${args.path ?? '.'}` },
        ],
        isError: true,
      }
    }

    dirents.sort((a, b) =>
      a.name.toLowerCase().localeCompare(b.name.toLowerCase()),
    )

    const lines: string[] = []
    for (const entry of dirents) {
      if (lines.length >= limit) break
      lines.push(entry.isDirectory() ? `${entry.name}/` : entry.name)
    }

    if (lines.length === 0) {
      return { content: [{ type: 'text', text: 'Directory is empty.' }] }
    }

    const output = lines.join('\n')
    const result = truncateHead(output)

    const parts: string[] = []
    if (dirents.length > limit) {
      parts.push(`[Showing first ${limit} of ${dirents.length} entries]`)
    } else if (result.truncated) {
      parts.push(
        `[Output truncated — showing first ${result.outputLines} of ${result.totalLines} lines]`,
      )
    }
    parts.push(result.content)

    return { content: [{ type: 'text', text: parts.join('\n') }] }
  },
}
