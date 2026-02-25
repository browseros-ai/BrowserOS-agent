import { readFile, stat } from 'node:fs/promises'
import { z } from 'zod'
import {
  assertPathWithinCwd,
  escapeRegExp,
  matchesGlob,
  resolvePathInCwd,
  safeRelativePath,
  toPosixPath,
} from './path-utils'
import { walkEntries } from './scan'
import {
  DEFAULT_MAX_BYTES,
  formatSize,
  GREP_MAX_LINE_LENGTH,
  truncateHead,
  truncateLine,
} from './truncate'
import type { FilesystemTool } from './types'

const grepInputSchema = z.object({
  pattern: z.string().describe('Search pattern (regex or literal string)'),
  path: z
    .string()
    .optional()
    .describe('Directory or file to search (default: current directory)'),
  glob: z
    .string()
    .optional()
    .describe('Optional glob file filter, e.g. *.ts or **/*.spec.ts'),
  ignoreCase: z
    .boolean()
    .optional()
    .describe('Case-insensitive search (default: false)'),
  literal: z
    .boolean()
    .optional()
    .describe('Treat pattern as literal string (default: false)'),
  context: z
    .number()
    .int()
    .nonnegative()
    .optional()
    .describe('Number of lines before and after each match'),
  limit: z
    .number()
    .int()
    .positive()
    .optional()
    .describe('Maximum number of matches to return (default: 100)'),
})

type GrepInput = z.infer<typeof grepInputSchema>

const DEFAULT_LIMIT = 100

function isBinaryContent(content: Buffer): boolean {
  return content.subarray(0, 1_024).includes(0)
}

function buildPatternRegex(params: {
  pattern: string
  ignoreCase?: boolean
  literal?: boolean
}): RegExp {
  const source = params.literal ? escapeRegExp(params.pattern) : params.pattern
  return new RegExp(source, params.ignoreCase ? 'i' : '')
}

function formatMatchLine(
  filePath: string,
  lineNumber: number,
  line: string,
): string {
  const truncated = truncateLine(line.replace(/\r/g, ''), GREP_MAX_LINE_LENGTH)
  return `${filePath}:${lineNumber}: ${truncated.text}`
}

function formatContextLine(
  filePath: string,
  lineNumber: number,
  line: string,
): string {
  const truncated = truncateLine(line.replace(/\r/g, ''), GREP_MAX_LINE_LENGTH)
  return `${filePath}-${lineNumber}- ${truncated.text}`
}

async function collectSearchFiles(searchPath: string): Promise<string[]> {
  const searchStats = await stat(searchPath)
  if (!searchStats.isDirectory()) {
    return [searchPath]
  }

  const entries = await walkEntries(searchPath)
  return entries
    .filter((entry) => !entry.isDirectory)
    .map((entry) => entry.absolutePath)
}

function collectContextLines(params: {
  relativePath: string
  lineIndex: number
  lines: string[]
  contextLines: number
}): string[] {
  const { relativePath, lineIndex, lines, contextLines } = params

  if (contextLines === 0) {
    return [
      formatMatchLine(relativePath, lineIndex + 1, lines[lineIndex] ?? ''),
    ]
  }

  const start = Math.max(0, lineIndex - contextLines)
  const end = Math.min(lines.length - 1, lineIndex + contextLines)
  const output: string[] = []

  for (let i = start; i <= end; i++) {
    const line = lines[i] ?? ''
    output.push(
      i === lineIndex
        ? formatMatchLine(relativePath, i + 1, line)
        : formatContextLine(relativePath, i + 1, line),
    )
  }

  return output
}

async function searchFile(params: {
  filePath: string
  searchRoot: string
  regex: RegExp
  contextLines: number
  glob?: string
  remainingLimit: number
}): Promise<{ matches: string[]; matchCount: number }> {
  const { filePath, searchRoot, regex, contextLines, glob, remainingLimit } =
    params
  const relativePath = safeRelativePath(filePath, searchRoot)

  if (!matchesGlob(relativePath, glob)) {
    return { matches: [], matchCount: 0 }
  }

  const fileBuffer = await readFile(filePath)
  if (isBinaryContent(fileBuffer)) {
    return { matches: [], matchCount: 0 }
  }

  const lines = fileBuffer.toString('utf-8').split('\n')
  const matches: string[] = []
  let matchCount = 0

  for (let index = 0; index < lines.length; index++) {
    if (matchCount >= remainingLimit) break

    const line = lines[index] ?? ''
    if (!regex.test(line)) continue

    matches.push(
      ...collectContextLines({
        relativePath,
        lineIndex: index,
        lines,
        contextLines,
      }),
    )

    matchCount++
  }

  return { matches, matchCount }
}

function buildResultText(params: {
  pattern: string
  rawPath?: string
  matchCount: number
  matches: string[]
  effectiveLimit: number
}): string {
  const { pattern, rawPath, matchCount, matches, effectiveLimit } = params
  const header = `Found ${matchCount} match(es) for pattern "${pattern}" in ${toPosixPath(rawPath || '.')}:`
  const truncation = truncateHead(`${header}\n${matches.join('\n')}`, {
    maxLines: Number.MAX_SAFE_INTEGER,
    maxBytes: DEFAULT_MAX_BYTES,
  })

  const notices: string[] = []
  if (matchCount >= effectiveLimit) {
    notices.push(`${effectiveLimit} results limit reached`)
  }
  if (truncation.truncated) {
    notices.push(`${formatSize(DEFAULT_MAX_BYTES)} output limit reached`)
  }

  return notices.length > 0
    ? `${truncation.content}\n\n[${notices.join('. ')}]`
    : truncation.content
}

export const grepTool: FilesystemTool<GrepInput> = {
  name: 'grep',
  description:
    'Search file contents for a pattern. Returns matching lines with file paths and line numbers.',
  inputSchema: grepInputSchema,
  execute: async (
    { pattern, path: rawPath, glob, ignoreCase, literal, context, limit },
    cwd,
  ) => {
    const searchPath = resolvePathInCwd(rawPath || '.', cwd)
    assertPathWithinCwd(searchPath, cwd)

    const searchStats = await stat(searchPath)
    const searchRoot = searchStats.isDirectory() ? searchPath : cwd
    const files = await collectSearchFiles(searchPath)

    const regex = buildPatternRegex({ pattern, ignoreCase, literal })
    const contextLines = context ?? 0
    const effectiveLimit = limit ?? DEFAULT_LIMIT

    const formattedMatches: string[] = []
    let totalMatches = 0

    for (const filePath of files) {
      if (totalMatches >= effectiveLimit) break

      const result = await searchFile({
        filePath,
        searchRoot,
        regex,
        contextLines,
        glob,
        remainingLimit: effectiveLimit - totalMatches,
      })

      formattedMatches.push(...result.matches)
      totalMatches += result.matchCount
    }

    if (formattedMatches.length === 0) {
      return {
        content: [{ type: 'text', text: 'No matches found for pattern' }],
      }
    }

    return {
      content: [
        {
          type: 'text',
          text: buildResultText({
            pattern,
            rawPath,
            matchCount: totalMatches,
            matches: formattedMatches,
            effectiveLimit,
          }),
        },
      ],
    }
  },
}
