export const DEFAULT_MAX_LINES = 2_000
export const DEFAULT_MAX_BYTES = 50 * 1_024
export const GREP_MAX_LINE_LENGTH = 500

export interface TruncationResult {
  content: string
  truncated: boolean
  truncatedBy: 'lines' | 'bytes' | null
  totalLines: number
  totalBytes: number
  outputLines: number
  outputBytes: number
  lastLinePartial: boolean
  firstLineExceedsLimit: boolean
  maxLines: number
  maxBytes: number
}

export interface TruncationOptions {
  maxLines?: number
  maxBytes?: number
}

export function formatSize(bytes: number): string {
  if (bytes < 1_024) return `${bytes}B`
  if (bytes < 1_024 * 1_024) return `${(bytes / 1_024).toFixed(1)}KB`
  return `${(bytes / (1_024 * 1_024)).toFixed(1)}MB`
}

export function truncateHead(
  content: string,
  options: TruncationOptions = {},
): TruncationResult {
  const maxLines = options.maxLines ?? DEFAULT_MAX_LINES
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES

  const totalBytes = Buffer.byteLength(content, 'utf-8')
  const lines = content.split('\n')
  const totalLines = lines.length

  if (totalLines <= maxLines && totalBytes <= maxBytes) {
    return {
      content,
      truncated: false,
      truncatedBy: null,
      totalLines,
      totalBytes,
      outputLines: totalLines,
      outputBytes: totalBytes,
      lastLinePartial: false,
      firstLineExceedsLimit: false,
      maxLines,
      maxBytes,
    }
  }

  const firstLineBytes = Buffer.byteLength(lines[0] ?? '', 'utf-8')
  if (firstLineBytes > maxBytes) {
    return {
      content: '',
      truncated: true,
      truncatedBy: 'bytes',
      totalLines,
      totalBytes,
      outputLines: 0,
      outputBytes: 0,
      lastLinePartial: false,
      firstLineExceedsLimit: true,
      maxLines,
      maxBytes,
    }
  }

  const outputLines: string[] = []
  let outputBytes = 0
  let truncatedBy: 'lines' | 'bytes' = 'lines'

  for (let i = 0; i < lines.length && i < maxLines; i++) {
    const line = lines[i] ?? ''
    const lineBytes = Buffer.byteLength(line, 'utf-8') + (i > 0 ? 1 : 0)
    if (outputBytes + lineBytes > maxBytes) {
      truncatedBy = 'bytes'
      break
    }
    outputLines.push(line)
    outputBytes += lineBytes
  }

  if (outputLines.length >= maxLines && outputBytes <= maxBytes) {
    truncatedBy = 'lines'
  }

  const outputContent = outputLines.join('\n')

  return {
    content: outputContent,
    truncated: true,
    truncatedBy,
    totalLines,
    totalBytes,
    outputLines: outputLines.length,
    outputBytes: Buffer.byteLength(outputContent, 'utf-8'),
    lastLinePartial: false,
    firstLineExceedsLimit: false,
    maxLines,
    maxBytes,
  }
}

export function truncateTail(
  content: string,
  options: TruncationOptions = {},
): TruncationResult {
  const maxLines = options.maxLines ?? DEFAULT_MAX_LINES
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES

  const totalBytes = Buffer.byteLength(content, 'utf-8')
  const lines = content.split('\n')
  const totalLines = lines.length

  if (totalLines <= maxLines && totalBytes <= maxBytes) {
    return {
      content,
      truncated: false,
      truncatedBy: null,
      totalLines,
      totalBytes,
      outputLines: totalLines,
      outputBytes: totalBytes,
      lastLinePartial: false,
      firstLineExceedsLimit: false,
      maxLines,
      maxBytes,
    }
  }

  const outputLines: string[] = []
  let outputBytes = 0
  let truncatedBy: 'lines' | 'bytes' = 'lines'
  let lastLinePartial = false

  for (let i = lines.length - 1; i >= 0 && outputLines.length < maxLines; i--) {
    const line = lines[i] ?? ''
    const lineBytes =
      Buffer.byteLength(line, 'utf-8') + (outputLines.length > 0 ? 1 : 0)

    if (outputBytes + lineBytes > maxBytes) {
      truncatedBy = 'bytes'
      if (outputLines.length === 0) {
        outputLines.unshift(truncateStringToBytesFromEnd(line, maxBytes))
        outputBytes = Buffer.byteLength(outputLines[0] ?? '', 'utf-8')
        lastLinePartial = true
      }
      break
    }

    outputLines.unshift(line)
    outputBytes += lineBytes
  }

  if (outputLines.length >= maxLines && outputBytes <= maxBytes) {
    truncatedBy = 'lines'
  }

  const outputContent = outputLines.join('\n')

  return {
    content: outputContent,
    truncated: true,
    truncatedBy,
    totalLines,
    totalBytes,
    outputLines: outputLines.length,
    outputBytes: Buffer.byteLength(outputContent, 'utf-8'),
    lastLinePartial,
    firstLineExceedsLimit: false,
    maxLines,
    maxBytes,
  }
}

function truncateStringToBytesFromEnd(str: string, maxBytes: number): string {
  const buffer = Buffer.from(str, 'utf-8')
  if (buffer.length <= maxBytes) return str

  let start = buffer.length - maxBytes
  while (start < buffer.length && (buffer[start] & 0xc0) === 0x80) {
    start++
  }
  return buffer.slice(start).toString('utf-8')
}

export function truncateLine(
  line: string,
  maxChars: number = GREP_MAX_LINE_LENGTH,
): { text: string; wasTruncated: boolean } {
  if (line.length <= maxChars) {
    return { text: line, wasTruncated: false }
  }
  return {
    text: `${line.slice(0, maxChars)}... [truncated]`,
    wasTruncated: true,
  }
}
