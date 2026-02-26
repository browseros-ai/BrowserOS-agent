import { readFile, writeFile } from 'node:fs/promises'
import { z } from 'zod'
import { assertPathWithinCwd, resolvePathInCwd } from './path-utils'
import type { FilesystemTool } from './types'

const editInputSchema = z.object({
  path: z.string().describe('Path to the file to edit (relative or absolute)'),
  oldText: z
    .string()
    .describe('Exact text to find and replace (must be unique in the file)'),
  newText: z.string().describe('New text to replace the old text with'),
})

type EditInput = z.infer<typeof editInputSchema>

function stripBom(content: string): { bom: string; text: string } {
  return content.startsWith('\uFEFF')
    ? { bom: '\uFEFF', text: content.slice(1) }
    : { bom: '', text: content }
}

function detectLineEnding(content: string): '\r\n' | '\n' {
  const crlfIndex = content.indexOf('\r\n')
  const lfIndex = content.indexOf('\n')
  if (lfIndex === -1 || crlfIndex === -1) return '\n'
  return crlfIndex < lfIndex ? '\r\n' : '\n'
}

function normalizeToLf(content: string): string {
  return content.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
}

function restoreLineEndings(
  content: string,
  lineEnding: '\r\n' | '\n',
): string {
  return lineEnding === '\r\n' ? content.replace(/\n/g, '\r\n') : content
}

export const editTool: FilesystemTool<EditInput> = {
  name: 'edit',
  description:
    'Edit a file by replacing exact text. The oldText must match exactly and be unique.',
  inputSchema: editInputSchema,
  execute: async ({ path: rawPath, oldText, newText }, cwd) => {
    const absolutePath = resolvePathInCwd(rawPath, cwd)
    assertPathWithinCwd(absolutePath, cwd)

    const rawContent = await readFile(absolutePath, 'utf-8')
    const { bom, text: withoutBom } = stripBom(rawContent)

    const lineEnding = detectLineEnding(withoutBom)
    const normalizedContent = normalizeToLf(withoutBom)
    const normalizedOldText = normalizeToLf(oldText)
    const normalizedNewText = normalizeToLf(newText)

    if (!normalizedContent.includes(normalizedOldText)) {
      throw new Error(
        `Could not find the exact text in ${rawPath}. The oldText value must match exactly.`,
      )
    }

    const occurrences = normalizedContent.split(normalizedOldText).length - 1
    if (occurrences > 1) {
      throw new Error(
        `Found ${occurrences} occurrences in ${rawPath}. oldText must be unique.`,
      )
    }

    const replacedContent = normalizedContent.replace(
      normalizedOldText,
      normalizedNewText,
    )

    if (replacedContent === normalizedContent) {
      throw new Error(`No changes made to ${rawPath}.`)
    }

    await writeFile(
      absolutePath,
      `${bom}${restoreLineEndings(replacedContent, lineEnding)}`,
      'utf-8',
    )

    return {
      content: [
        {
          type: 'text',
          text: `Successfully replaced text in ${rawPath}.`,
        },
      ],
    }
  },
}
