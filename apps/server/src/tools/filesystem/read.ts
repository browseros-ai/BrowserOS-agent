import { readFile } from 'node:fs/promises'
import { extname, resolve } from 'node:path'
import { tool } from 'ai'
import { z } from 'zod'
import {
  executeWithMetrics,
  IMAGE_EXTENSIONS,
  IMAGE_MIME_TYPES,
  toModelOutput,
  truncateHead,
} from './utils'

const TOOL_NAME = 'filesystem_read'

export function createReadTool(cwd: string) {
  return tool({
    description:
      'Read a file from the filesystem. Returns text content with line numbers, or image data for image files. Use offset and limit to paginate through large files.',
    inputSchema: z.object({
      path: z
        .string()
        .describe('File path (relative to working directory or absolute)'),
      offset: z
        .number()
        .optional()
        .describe('Starting line number (1-indexed)'),
      limit: z.number().optional().describe('Maximum number of lines to read'),
    }),
    execute: (params) =>
      executeWithMetrics(TOOL_NAME, async () => {
        const resolved = resolve(cwd, params.path)
        const ext = extname(resolved).toLowerCase()

        if (IMAGE_EXTENSIONS.has(ext)) {
          const buffer = await readFile(resolved)
          const mimeType = IMAGE_MIME_TYPES[ext] || 'application/octet-stream'
          return {
            text: `Image: ${params.path} (${buffer.byteLength} bytes)`,
            images: [{ data: buffer.toString('base64'), mimeType }],
          }
        }

        const content = await readFile(resolved, 'utf-8')
        const allLines = content.split('\n')
        const totalLines = allLines.length

        const startIdx = params.offset ? Math.max(0, params.offset - 1) : 0
        if (startIdx >= totalLines) {
          return {
            text: `File has ${totalLines} lines. Offset ${params.offset} is beyond end of file.`,
          }
        }

        let selected = allLines.slice(startIdx)
        if (params.limit && params.limit < selected.length) {
          selected = selected.slice(0, params.limit)
        }

        const truncated = truncateHead(selected.join('\n'))
        const displayLines = truncated.content.split('\n')
        const endLineNum = startIdx + displayLines.length
        const width = String(endLineNum).length

        const numbered = displayLines
          .map((line, i) => {
            const num = String(startIdx + i + 1).padStart(width)
            return `${num} | ${line}`
          })
          .join('\n')

        let result = numbered
        if (truncated.truncated) {
          result += `\n\n(Showing ${displayLines.length} of ${totalLines} lines. Use offset=${startIdx + displayLines.length + 1} to continue reading.)`
        } else if (startIdx > 0) {
          result += `\n\n(Showing lines ${startIdx + 1}-${endLineNum} of ${totalLines})`
        }

        return { text: result }
      }),
    toModelOutput,
  })
}
