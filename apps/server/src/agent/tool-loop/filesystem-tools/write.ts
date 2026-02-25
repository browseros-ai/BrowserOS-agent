import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { z } from 'zod'
import { assertPathWithinCwd, resolvePathInCwd } from './path-utils'
import type { FilesystemTool } from './types'

const writeInputSchema = z.object({
  path: z.string().describe('Path to the file to write (relative or absolute)'),
  content: z.string().describe('Content to write to the file'),
})

type WriteInput = z.infer<typeof writeInputSchema>

export const writeTool: FilesystemTool<WriteInput> = {
  name: 'write',
  description:
    'Write content to a file. Creates the file if it does not exist and overwrites it if it does.',
  inputSchema: writeInputSchema,
  execute: async ({ path: rawPath, content }, cwd) => {
    const absolutePath = resolvePathInCwd(rawPath, cwd)
    assertPathWithinCwd(absolutePath, cwd)

    const directory = path.dirname(absolutePath)
    await mkdir(directory, { recursive: true })
    await writeFile(absolutePath, content, 'utf-8')

    return {
      content: [
        {
          type: 'text',
          text: `Successfully wrote ${Buffer.byteLength(content, 'utf-8')} bytes to ${rawPath}`,
        },
      ],
    }
  },
}
