import { resolve } from 'node:path'
import { z } from 'zod'
import type { FilesystemToolDef } from './build-toolset'
import { PathTraversalError, resolveAndAssert } from './path-utils'
import { truncateHead } from './truncate'

const MAX_LINE_LENGTH = 500
const DEFAULT_MATCH_LIMIT = 100
const SKIP_DIRS = new Set([
  '.git',
  'node_modules',
  '.next',
  'dist',
  '.cache',
  '__pycache__',
])

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function buildRegex(
  pattern: string,
  literal?: boolean,
  ignoreCase?: boolean,
): RegExp {
  const flags = ignoreCase ? 'i' : ''
  return literal
    ? new RegExp(escapeRegex(pattern), flags)
    : new RegExp(pattern, flags)
}

function toFileGlob(glob?: string): string {
  if (!glob) return '**/*'
  return glob.includes('/') ? glob : `**/${glob}`
}

function shouldSkipPath(filePath: string): boolean {
  return filePath.split('/').some((p) => SKIP_DIRS.has(p))
}

function searchFileLines(
  lines: string[],
  regex: RegExp,
  filePath: string,
  contextLines: number,
  output: string[],
  matchCount: number,
  matchLimit: number,
): number {
  for (let i = 0; i < lines.length; i++) {
    if (matchCount >= matchLimit) break
    if (!regex.test(lines[i])) continue

    for (let b = Math.max(0, i - contextLines); b < i; b++) {
      output.push(`${filePath}-${b + 1}-${lines[b]}`)
    }
    output.push(`${filePath}:${i + 1}:${lines[i]}`)
    for (
      let a = i + 1;
      a <= Math.min(lines.length - 1, i + contextLines);
      a++
    ) {
      output.push(`${filePath}-${a + 1}-${lines[a]}`)
    }
    if (contextLines > 0) output.push('--')

    matchCount++
  }
  return matchCount
}

export const grep: FilesystemToolDef = {
  name: 'grep',
  description:
    'Search file contents for a pattern. Returns matching lines with file paths and line numbers. ' +
    'Output is truncated to 100 matches or 50KB.',
  input: z.object({
    pattern: z.string().describe('Search pattern (regex or literal string)'),
    path: z
      .string()
      .optional()
      .describe('Directory or file to search (default: current directory)'),
    glob: z
      .string()
      .optional()
      .describe("Filter files by glob pattern, e.g. '*.ts'"),
    ignore_case: z
      .boolean()
      .optional()
      .describe('Case-insensitive search (default: false)'),
    literal: z
      .boolean()
      .optional()
      .describe(
        'Treat pattern as literal string instead of regex (default: false)',
      ),
    context: z
      .number()
      .optional()
      .describe(
        'Number of context lines before and after each match (default: 0)',
      ),
    limit: z
      .number()
      .optional()
      .describe('Maximum number of matches to return (default: 100)'),
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
    const matchLimit = args.limit ?? DEFAULT_MATCH_LIMIT
    const contextLines = args.context ?? 0

    let regex: RegExp
    try {
      regex = buildRegex(args.pattern, args.literal, args.ignore_case)
    } catch {
      return {
        content: [
          { type: 'text', text: `Invalid regex pattern: ${args.pattern}` },
        ],
        isError: true,
      }
    }

    const glob = new Bun.Glob(toFileGlob(args.glob))
    const output: string[] = []
    let matchCount = 0

    for await (const filePath of glob.scan({
      cwd: searchPath,
      dot: true,
      onlyFiles: true,
    })) {
      if (matchCount >= matchLimit) break
      if (shouldSkipPath(filePath)) continue

      let content: string
      try {
        content = await Bun.file(resolve(searchPath, filePath)).text()
      } catch {
        continue
      }

      if (content.substring(0, 512).includes('\0')) continue

      matchCount = searchFileLines(
        content.split('\n'),
        regex,
        filePath,
        contextLines,
        output,
        matchCount,
        matchLimit,
      )
    }

    if (output.length === 0) {
      return { content: [{ type: 'text', text: 'No matches found.' }] }
    }

    const truncatedLines = output.map((line) =>
      line.length > MAX_LINE_LENGTH
        ? `${line.substring(0, MAX_LINE_LENGTH)} [truncated]`
        : line,
    )

    const result = truncateHead(truncatedLines.join('\n'))

    const header: string[] = []
    if (matchCount >= matchLimit) {
      header.push(
        `[Reached limit of ${matchLimit} matches. Increase limit or narrow your search.]`,
      )
    }
    if (result.truncated) {
      header.push(
        `[Output truncated — showing first ${result.outputLines} of ${result.totalLines} lines]`,
      )
    }
    header.push(result.content)

    return { content: [{ type: 'text', text: header.join('\n') }] }
  },
}
