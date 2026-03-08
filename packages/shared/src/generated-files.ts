import { z } from 'zod'

export const GeneratedFileOperationSchema = z.enum([
  'created',
  'updated',
  'saved',
  'downloaded',
])

export const GeneratedFileSchema = z.object({
  path: z.string().min(1),
  mediaType: z.string().optional(),
  sourceTool: z.string().min(1),
  operation: GeneratedFileOperationSchema,
})

export const GeneratedFilesSchema = z.array(GeneratedFileSchema)

export type GeneratedFileOperation = z.infer<
  typeof GeneratedFileOperationSchema
>
export type GeneratedFile = z.infer<typeof GeneratedFileSchema>
export type GeneratedFileOpenMode = 'browser' | 'native'

const MEDIA_TYPES_BY_EXTENSION: Record<string, string> = {
  '.bmp': 'image/bmp',
  '.csv': 'text/csv',
  '.gif': 'image/gif',
  '.htm': 'text/html',
  '.html': 'text/html',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.json': 'application/json',
  '.md': 'text/markdown',
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain',
  '.webp': 'image/webp',
}

const BROWSER_MEDIA_TYPES = new Set(['application/pdf', 'text/html'])

export function getGeneratedFileName(filePath: string): string {
  const normalized = filePath.replaceAll('\\', '/')
  const segments = normalized.split('/').filter(Boolean)
  return segments.at(-1) ?? filePath
}

export function getGeneratedFileExtension(filePath: string): string {
  const filename = getGeneratedFileName(filePath)
  const dotIndex = filename.lastIndexOf('.')
  if (dotIndex === -1) return ''
  return filename.slice(dotIndex).toLowerCase()
}

function normalizeMediaType(mediaType?: string): string | undefined {
  return mediaType?.split(';', 1)[0]?.trim().toLowerCase() || undefined
}

export function getGeneratedFileMediaType(
  filePath: string,
  mediaType?: string,
): string | undefined {
  const normalized = normalizeMediaType(mediaType)
  if (normalized) return normalized
  return MEDIA_TYPES_BY_EXTENSION[getGeneratedFileExtension(filePath)]
}

export function getGeneratedFileOpenMode(
  filePath: string,
  mediaType?: string,
): GeneratedFileOpenMode {
  const resolvedMediaType = getGeneratedFileMediaType(filePath, mediaType)
  if (!resolvedMediaType) return 'native'
  return BROWSER_MEDIA_TYPES.has(resolvedMediaType) ? 'browser' : 'native'
}

export function getGeneratedFileTypeLabel(
  filePath: string,
  mediaType?: string,
): string {
  const resolvedMediaType = getGeneratedFileMediaType(filePath, mediaType)
  switch (resolvedMediaType) {
    case 'application/json':
      return 'JSON file'
    case 'application/pdf':
      return 'PDF document'
    case 'image/bmp':
    case 'image/gif':
    case 'image/jpeg':
    case 'image/png':
    case 'image/svg+xml':
    case 'image/webp':
      return 'Image'
    case 'text/csv':
      return 'CSV file'
    case 'text/html':
      return 'HTML document'
    case 'text/markdown':
      return 'Markdown document'
    case 'text/plain':
      return 'Text file'
    default: {
      const extension = getGeneratedFileExtension(filePath)
      if (!extension) return 'File'
      return `${extension.slice(1).toUpperCase()} file`
    }
  }
}
