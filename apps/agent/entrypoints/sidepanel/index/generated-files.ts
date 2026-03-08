import {
  type GeneratedFile,
  type GeneratedFileOpenMode,
  GeneratedFileSchema,
  getGeneratedFileMediaType,
  getGeneratedFileName,
  getGeneratedFileOpenMode,
  getGeneratedFileTypeLabel,
} from '@browseros/shared/generated-files'
import type { DynamicToolUIPart, ToolUIPart, UIMessage } from 'ai'

export interface MessageGeneratedFile extends GeneratedFile {
  fileName: string
  openMode: GeneratedFileOpenMode
  typeLabel: string
}

type ToolLikePart = DynamicToolUIPart | ToolUIPart

function extractGeneratedFilesFromOutput(output: unknown): GeneratedFile[] {
  if (!output || typeof output !== 'object') return []

  const record = output as {
    generatedFiles?: unknown
    structuredContent?: { generatedFiles?: unknown }
  }
  const candidates: unknown[] = []

  if (Array.isArray(record.generatedFiles)) {
    candidates.push(...record.generatedFiles)
  }

  if (
    record.structuredContent &&
    typeof record.structuredContent === 'object' &&
    Array.isArray(record.structuredContent.generatedFiles)
  ) {
    candidates.push(...record.structuredContent.generatedFiles)
  }

  return candidates.flatMap((candidate) => {
    const parsed = GeneratedFileSchema.safeParse(candidate)
    return parsed.success ? [parsed.data] : []
  })
}

function extractGeneratedFilesFromPart(part: ToolLikePart): GeneratedFile[] {
  if (part.state !== 'output-available' || part.preliminary) {
    return []
  }

  return extractGeneratedFilesFromOutput(part.output)
}

function dedupeGeneratedFiles(
  files: MessageGeneratedFile[],
): MessageGeneratedFile[] {
  const seen = new Set<string>()
  const deduped: MessageGeneratedFile[] = []

  for (let index = files.length - 1; index >= 0; index--) {
    const file = files[index]
    if (seen.has(file.path)) continue
    seen.add(file.path)
    deduped.unshift(file)
  }

  return deduped
}

export function getGeneratedFilesFromMessage(
  message: UIMessage,
): MessageGeneratedFile[] {
  if (message.role !== 'assistant') return []

  const files: MessageGeneratedFile[] = []

  for (const part of message.parts) {
    if (!(part.type === 'dynamic-tool' || part.type.startsWith('tool-'))) {
      continue
    }

    const toolPart = part as ToolLikePart
    const generatedFiles = extractGeneratedFilesFromPart(toolPart)

    for (const generatedFile of generatedFiles) {
      const mediaType = getGeneratedFileMediaType(
        generatedFile.path,
        generatedFile.mediaType,
      )
      files.push({
        ...generatedFile,
        mediaType,
        fileName: getGeneratedFileName(generatedFile.path),
        openMode: getGeneratedFileOpenMode(generatedFile.path, mediaType),
        typeLabel: getGeneratedFileTypeLabel(generatedFile.path, mediaType),
      })
    }
  }

  return dedupeGeneratedFiles(files)
}
