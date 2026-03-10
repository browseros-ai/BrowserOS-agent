import { randomUUID } from 'node:crypto'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

function sanitizeSegment(value: string): string {
  const sanitized = value.replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '')
  return sanitized || 'tool-output'
}

export async function writeTempToolOutputFile(args: {
  toolName: string
  extension: string
  content: string
}): Promise<string> {
  const outputDir = await mkdtemp(join(tmpdir(), 'browseros-tool-output-'))
  const toolName = sanitizeSegment(args.toolName)
  const extension = sanitizeSegment(args.extension) || 'txt'
  const filePath = join(
    outputDir,
    `${toolName}-${Date.now()}-${randomUUID()}.${extension}`,
  )

  await Bun.write(filePath, args.content)
  return filePath
}
