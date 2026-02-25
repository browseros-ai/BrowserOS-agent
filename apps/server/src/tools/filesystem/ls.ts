import { readdir, stat } from 'node:fs/promises'
import { resolve } from 'node:path'
import { z } from 'zod'
import type { FilesystemToolDef } from './build-toolset'
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
    const dirPath = args.path ? resolve(cwd, args.path) : cwd
    const limit = args.limit ?? DEFAULT_ENTRY_LIMIT

    let entries: string[]
    try {
      entries = await readdir(dirPath)
    } catch {
      return {
        content: [
          { type: 'text', text: `Cannot read directory: ${args.path ?? '.'}` },
        ],
        isError: true,
      }
    }

    entries.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))

    const lines: string[] = []
    for (const entry of entries) {
      if (lines.length >= limit) break
      try {
        const s = await stat(resolve(dirPath, entry))
        lines.push(s.isDirectory() ? `${entry}/` : entry)
      } catch {
        // skip entries that can't be stat'd
      }
    }

    if (lines.length === 0) {
      return { content: [{ type: 'text', text: 'Directory is empty.' }] }
    }

    const output = lines.join('\n')
    const result = truncateHead(output)

    const parts: string[] = []
    if (entries.length > limit) {
      parts.push(`[Showing first ${limit} of ${entries.length} entries]`)
    } else if (result.truncated) {
      parts.push(
        `[Output truncated — showing first ${result.outputLines} of ${result.totalLines} lines]`,
      )
    }
    parts.push(result.content)

    return { content: [{ type: 'text', text: parts.join('\n') }] }
  },
}
