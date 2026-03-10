import { randomUUID } from 'node:crypto'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { PATHS } from '@browseros/shared/constants/paths'
import type { ToolContext } from './framework'

function sanitizeSegment(value: string): string {
  const sanitized = value.replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '')
  return sanitized || 'tool-output'
}

export async function writeToolOutputFile(
  ctx: ToolContext,
  args: {
    toolName: string
    extension: string
    content: string
  },
): Promise<string> {
  const outputDir = join(
    ctx.directories.executionDir,
    PATHS.TOOL_OUTPUT_DIR_NAME,
  )
  await mkdir(outputDir, { recursive: true })

  const toolName = sanitizeSegment(args.toolName)
  const extension = sanitizeSegment(args.extension) || 'txt'
  const filePath = join(
    outputDir,
    `${toolName}-${Date.now()}-${randomUUID()}.${extension}`,
  )

  await Bun.write(filePath, args.content)
  return filePath
}
