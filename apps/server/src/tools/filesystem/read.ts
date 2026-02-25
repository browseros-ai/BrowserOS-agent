import { extname, resolve } from 'node:path'
import { z } from 'zod'
import type { FilesystemToolDef } from './build-toolset'
import { truncateHead } from './truncate'

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp'])
const MIME_MAP: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
}

export const read: FilesystemToolDef = {
  name: 'read',
  description:
    'Read the contents of a file. Supports text files and images (jpg, png, gif, webp). ' +
    'For text files, output is truncated to 2000 lines or 50KB. ' +
    'Use offset/limit for large files. Continue with offset until complete.',
  input: z.object({
    path: z
      .string()
      .describe('Path to the file to read (relative or absolute)'),
    offset: z
      .number()
      .optional()
      .describe('Line number to start reading from (1-indexed)'),
    limit: z.number().optional().describe('Maximum number of lines to read'),
  }),
  async execute(args, cwd) {
    const filePath = resolve(cwd, args.path)

    const ext = extname(filePath).toLowerCase()
    if (IMAGE_EXTENSIONS.has(ext)) {
      const file = Bun.file(filePath)
      if (!(await file.exists())) {
        return {
          content: [{ type: 'text', text: `File not found: ${args.path}` }],
          isError: true,
        }
      }
      const buffer = await file.arrayBuffer()
      const data = Buffer.from(buffer).toString('base64')
      const mimeType = MIME_MAP[ext] ?? 'application/octet-stream'
      return {
        content: [
          { type: 'text', text: `Image: ${args.path}` },
          { type: 'image', data, mimeType },
        ],
      }
    }

    const file = Bun.file(filePath)
    if (!(await file.exists())) {
      return {
        content: [{ type: 'text', text: `File not found: ${args.path}` }],
        isError: true,
      }
    }

    const raw = await file.text()
    const allLines = raw.split('\n')
    const totalLines = allLines.length

    const startIndex = args.offset ? Math.max(0, args.offset - 1) : 0
    const endIndex = args.limit
      ? Math.min(totalLines, startIndex + args.limit)
      : totalLines
    const slice = allLines.slice(startIndex, endIndex)
    const sliceText = slice.join('\n')

    const result = truncateHead(sliceText)

    const parts: string[] = []

    if (result.truncated) {
      const shownEnd = startIndex + result.outputLines
      parts.push(
        `[Showing lines ${startIndex + 1}-${shownEnd} of ${totalLines}. ` +
          `Use offset=${shownEnd + 1} to continue.]`,
      )
    } else if (startIndex > 0 || endIndex < totalLines) {
      parts.push(
        `[Showing lines ${startIndex + 1}-${endIndex} of ${totalLines}]`,
      )
    }

    parts.push(result.content)

    return { content: [{ type: 'text', text: parts.join('\n') }] }
  },
}
