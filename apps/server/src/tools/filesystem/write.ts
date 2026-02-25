import { mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { z } from 'zod'
import type { FilesystemToolDef } from './build-toolset'

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
    const filePath = resolve(cwd, args.path)

    await mkdir(dirname(filePath), { recursive: true })
    await Bun.write(filePath, args.content)

    const bytes = Buffer.byteLength(args.content)
    return {
      content: [{ type: 'text', text: `Wrote ${bytes} bytes to ${args.path}` }],
    }
  },
}
