import { mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'
import { z } from 'zod'
import type { FilesystemToolDef } from './build-toolset'
import { PathTraversalError, resolveAndAssert } from './path-utils'

export const write: FilesystemToolDef = {
  name: 'write',
  description:
    "Write content to a file. Creates the file if it doesn't exist, overwrites if it does. " +
    'Automatically creates parent directories.',
  input: z.object({
    path: z
      .string()
      .describe('Path to the file to write (relative or absolute)'),
    content: z.string().describe('Content to write to the file'),
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

    await mkdir(dirname(filePath), { recursive: true })
    await Bun.write(filePath, args.content)

    const bytes = Buffer.byteLength(args.content)
    return {
      content: [{ type: 'text', text: `Wrote ${bytes} bytes to ${args.path}` }],
    }
  },
}
