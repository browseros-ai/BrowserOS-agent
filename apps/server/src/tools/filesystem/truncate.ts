const DEFAULT_MAX_LINES = 2000
const DEFAULT_MAX_BYTES = 50 * 1024

export interface TruncateOptions {
  maxLines?: number
  maxBytes?: number
}

export interface TruncateResult {
  content: string
  truncated: boolean
  totalLines: number
  outputLines: number
}

export function truncateHead(
  text: string,
  options?: TruncateOptions,
): TruncateResult {
  const maxLines = options?.maxLines ?? DEFAULT_MAX_LINES
  const maxBytes = options?.maxBytes ?? DEFAULT_MAX_BYTES

  const lines = text.split('\n')
  const totalLines = lines.length

  let output = ''
  let lineCount = 0

  for (const line of lines) {
    if (lineCount >= maxLines) break
    const candidate = lineCount === 0 ? line : `\n${line}`
    if (output.length + candidate.length > maxBytes && lineCount > 0) break
    output += candidate
    lineCount++
  }

  return {
    content: output,
    truncated: lineCount < totalLines,
    totalLines,
    outputLines: lineCount,
  }
}

export function truncateTail(
  text: string,
  options?: TruncateOptions,
): TruncateResult {
  const maxLines = options?.maxLines ?? DEFAULT_MAX_LINES
  const maxBytes = options?.maxBytes ?? DEFAULT_MAX_BYTES

  const lines = text.split('\n')
  const totalLines = lines.length

  const kept: string[] = []
  let byteCount = 0

  for (let i = lines.length - 1; i >= 0; i--) {
    const lineBytes = Buffer.byteLength(lines[i])
    if (kept.length >= maxLines) break
    if (byteCount + lineBytes > maxBytes && kept.length > 0) break
    kept.unshift(lines[i])
    byteCount += lineBytes + 1
  }

  return {
    content: kept.join('\n'),
    truncated: kept.length < totalLines,
    totalLines,
    outputLines: kept.length,
  }
}
