import type { LanguageModelV3ToolResultOutput } from '@ai-sdk/provider'
import { AGENT_LIMITS } from '@browseros/shared/constants/limits'
import type { ModelMessage, ToolContent } from 'ai'
import { logger } from '../../lib/logger'

function isBinaryContentPart(part: { type: string }): boolean {
  return (
    part.type === 'media' ||
    part.type === 'image-data' ||
    part.type === 'file-data'
  )
}

function measureToolResultOutput(
  output: LanguageModelV3ToolResultOutput,
): number {
  switch (output.type) {
    case 'text':
    case 'error-text':
      return output.value.length
    case 'json':
    case 'error-json':
      return JSON.stringify(output.value).length
    case 'execution-denied':
      return output.reason?.length ?? 0
    case 'content': {
      let size = 0
      for (const cp of output.value) {
        if (cp.type === 'text') size += cp.text.length
        else if (isBinaryContentPart(cp as { type: string }))
          size += (cp as { data?: string }).data?.length ?? 0
      }
      return size
    }
    default:
      return 0
  }
}

export function clearToolOutputs(
  messages: ModelMessage[],
  keepRecentCount = 3,
): ModelMessage[] {
  const toolIndices: number[] = []
  for (let i = 0; i < messages.length; i++) {
    if (messages[i].role === 'tool') toolIndices.push(i)
  }
  const protectedIndices = new Set(toolIndices.slice(-keepRecentCount))

  let cleared = 0
  const result = messages.map((msg, idx) => {
    if (msg.role !== 'tool' || protectedIndices.has(idx)) return msg

    const content = (msg.content as ToolContent).map((part) => {
      if (part.type !== 'tool-result') return part

      const output = part.output as LanguageModelV3ToolResultOutput
      const size = measureToolResultOutput(output)

      if (size <= AGENT_LIMITS.COMPACTION_CLEAR_OUTPUT_MIN_CHARS) return part

      cleared++
      return {
        ...part,
        output: {
          type: 'text' as const,
          value: `[Cleared — ${size} chars]`,
        },
      }
    })

    return { ...msg, content } as ModelMessage
  })

  if (cleared > 0) {
    logger.info('Cleared tool outputs', {
      clearedCount: cleared,
      protectedCount: protectedIndices.size,
    })
  }

  return result
}
