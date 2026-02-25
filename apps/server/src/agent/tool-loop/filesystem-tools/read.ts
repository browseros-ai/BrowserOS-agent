import { readFile, stat } from 'node:fs/promises'
import { z } from 'zod'
import { assertPathWithinCwd, resolvePathInCwd } from './path-utils'
import {
  DEFAULT_MAX_BYTES,
  DEFAULT_MAX_LINES,
  formatSize,
  truncateHead,
} from './truncate'
import type { FilesystemTool } from './types'

const IMAGE_MIME_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
}

const readInputSchema = z.object({
  path: z.string().describe('Path to the file to read (relative or absolute)'),
  offset: z
    .number()
    .int()
    .positive()
    .optional()
    .describe('Line number to start reading from (1-indexed)'),
  limit: z
    .number()
    .int()
    .positive()
    .optional()
    .describe('Maximum number of lines to read'),
})

type ReadInput = z.infer<typeof readInputSchema>

function detectImageMimeType(filePath: string): string | null {
  const lastDotIndex = filePath.lastIndexOf('.')
  if (lastDotIndex < 0) return null
  const extension = filePath.slice(lastDotIndex).toLowerCase()
  return IMAGE_MIME_TYPES[extension] ?? null
}

function assertNotDirectory(
  stats: { isDirectory(): boolean },
  rawPath: string,
): void {
  if (stats.isDirectory()) {
    throw new Error(`Path is a directory, expected a file: ${rawPath}`)
  }
}

function buildReadTextOutput(params: {
  rawPath: string
  selectedContent: string
  startLine: number
  totalLines: number
  userLimit?: number
}): string {
  const { rawPath, selectedContent, startLine, totalLines, userLimit } = params
  const truncation = truncateHead(selectedContent, {
    maxLines: DEFAULT_MAX_LINES,
    maxBytes: DEFAULT_MAX_BYTES,
  })

  if (truncation.firstLineExceedsLimit) {
    const firstLine = selectedContent.split('\n')[0] ?? ''
    const lineSize = formatSize(Buffer.byteLength(firstLine, 'utf-8'))
    return `[Line ${startLine} is ${lineSize}, exceeds ${formatSize(DEFAULT_MAX_BYTES)} limit. Use bash: sed -n '${startLine}p' ${rawPath} | head -c ${DEFAULT_MAX_BYTES}]`
  }

  if (truncation.truncated) {
    const endLine = startLine + truncation.outputLines - 1
    const nextOffset = endLine + 1
    const byLines = truncation.truncatedBy === 'lines'
    const suffix = byLines
      ? `[Showing lines ${startLine}-${endLine} of ${totalLines}. Use offset=${nextOffset} to continue.]`
      : `[Showing lines ${startLine}-${endLine} of ${totalLines} (${formatSize(DEFAULT_MAX_BYTES)} limit). Use offset=${nextOffset} to continue.]`
    return `${truncation.content}\n\n${suffix}`
  }

  if (userLimit !== undefined && startLine + userLimit - 1 < totalLines) {
    const nextOffset = startLine + userLimit
    const remaining = totalLines - (startLine + userLimit - 1)
    return `${truncation.content}\n\n[${remaining} more lines in file. Use offset=${nextOffset} to continue.]`
  }

  return truncation.content
}

export const readTool: FilesystemTool<ReadInput> = {
  name: 'read',
  description:
    'Read the contents of a file. Supports text files and images (jpg, png, gif, webp). For text files, output is truncated to 2000 lines or 50KB.',
  inputSchema: readInputSchema,
  execute: async ({ path: rawPath, offset, limit }, cwd) => {
    const absolutePath = resolvePathInCwd(rawPath, cwd)
    assertPathWithinCwd(absolutePath, cwd)

    const stats = await stat(absolutePath)
    assertNotDirectory(stats, rawPath)

    const mimeType = detectImageMimeType(absolutePath)
    if (mimeType) {
      const buffer = await readFile(absolutePath)
      return {
        content: [
          { type: 'text', text: `Read image file [${mimeType}]` },
          { type: 'image', data: buffer.toString('base64'), mimeType },
        ],
      }
    }

    const fileContent = await readFile(absolutePath, 'utf-8')
    const allLines = fileContent.split('\n')
    const totalLines = allLines.length
    const startLine = offset ?? 1
    const startIndex = startLine - 1

    if (startLine < 1) {
      throw new Error('Offset must be greater than or equal to 1')
    }

    if (startIndex >= totalLines) {
      throw new Error(
        `Offset ${startLine} is beyond end of file (${totalLines} lines total)`,
      )
    }

    const limitedLines = limit
      ? allLines.slice(startIndex, startIndex + limit)
      : allLines.slice(startIndex)

    const selectedContent = limitedLines.join('\n')
    const text = buildReadTextOutput({
      rawPath,
      selectedContent,
      startLine,
      totalLines,
      userLimit: limit,
    })

    return {
      content: [{ type: 'text', text }],
    }
  },
}
