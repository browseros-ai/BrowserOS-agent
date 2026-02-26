import { z } from 'zod'
import type { FilesystemToolDef } from './build-toolset'
import { PathTraversalError, resolveAndAssert } from './path-utils'

function detectLineEnding(text: string): string {
  const crlf = (text.match(/\r\n/g) || []).length
  const lf = (text.match(/(?<!\r)\n/g) || []).length
  const cr = (text.match(/\r(?!\n)/g) || []).length
  if (crlf > lf && crlf > cr) return '\r\n'
  if (cr > lf) return '\r'
  return '\n'
}

export const edit: FilesystemToolDef = {
  name: 'edit',
  description:
    'Edit a file by replacing exact text. The old_text must match exactly (including whitespace and indentation). ' +
    'Only one occurrence of old_text should exist in the file.',
  input: z.object({
    path: z
      .string()
      .describe('Path to the file to edit (relative or absolute)'),
    old_text: z
      .string()
      .describe('Exact text to find and replace (must match exactly)'),
    new_text: z.string().describe('New text to replace the old text with'),
  }),
  async execute(args, cwd) {
    let filePath: string
    try {
      filePath = await resolveAndAssert(args.path, cwd)
    } catch (e) {
      if (e instanceof PathTraversalError) {
        return {
          content: [{ type: 'text', text: e.message }],
          isError: true,
        }
      }
      throw e
    }

    const file = Bun.file(filePath)

    if (!(await file.exists())) {
      return {
        content: [{ type: 'text', text: `File not found: ${args.path}` }],
        isError: true,
      }
    }

    const rawBytes = new Uint8Array(await file.arrayBuffer())
    const hasBom =
      rawBytes.length >= 3 &&
      rawBytes[0] === 0xef &&
      rawBytes[1] === 0xbb &&
      rawBytes[2] === 0xbf
    const content = new TextDecoder().decode(
      hasBom ? rawBytes.slice(3) : rawBytes,
    )

    const lineEnding = detectLineEnding(content)

    const normalized = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
    const normalizedOld = args.old_text
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
    const normalizedNew = args.new_text
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')

    const occurrences = normalized.split(normalizedOld).length - 1

    if (occurrences === 0) {
      return {
        content: [
          {
            type: 'text',
            text: 'Text not found in file. Ensure old_text matches exactly including whitespace and indentation.',
          },
        ],
        isError: true,
      }
    }

    if (occurrences > 1) {
      return {
        content: [
          {
            type: 'text',
            text: `Found ${occurrences} occurrences of old_text. Provide a larger, unique context to match exactly one.`,
          },
        ],
        isError: true,
      }
    }

    if (normalizedOld === normalizedNew) {
      return {
        content: [
          {
            type: 'text',
            text: 'old_text and new_text are identical. No changes made.',
          },
        ],
        isError: true,
      }
    }

    let result = normalized.replace(normalizedOld, normalizedNew)

    if (lineEnding !== '\n') {
      result = result.replace(/\n/g, lineEnding)
    }

    if (hasBom) {
      const BOM = new Uint8Array([0xef, 0xbb, 0xbf])
      const encoded = new TextEncoder().encode(result)
      const withBom = new Uint8Array(BOM.length + encoded.length)
      withBom.set(BOM)
      withBom.set(encoded, BOM.length)
      await Bun.write(filePath, withBom)
    } else {
      await Bun.write(filePath, result)
    }

    const oldLines = normalizedOld.split('\n')
    const newLines = normalizedNew.split('\n')
    const changeStart = normalized
      .substring(0, normalized.indexOf(normalizedOld))
      .split('\n').length

    return {
      content: [
        {
          type: 'text',
          text: `Edited ${args.path} — replaced ${oldLines.length} line(s) with ${newLines.length} line(s) at line ${changeStart}.`,
        },
      ],
    }
  },
}
