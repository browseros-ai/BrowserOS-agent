import type { LanguageModelV3ToolResultOutput } from '@ai-sdk/provider'
import type { ModelMessage, ToolContent } from 'ai'

function isBinaryContentPart(part: { type: string }): boolean {
  return (
    part.type === 'media' ||
    part.type === 'image-data' ||
    part.type === 'file-data'
  )
}

export function stripBinaryContent(messages: ModelMessage[]): ModelMessage[] {
  return messages.map((msg) => {
    if (msg.role === 'user') return stripUserBinary(msg)
    if (msg.role === 'tool') return stripToolBinary(msg)
    return msg
  })
}

function stripUserBinary(msg: ModelMessage & { role: 'user' }): ModelMessage {
  if (typeof msg.content === 'string') return msg

  const content = msg.content.map((part) => {
    if (part.type === 'image') return { type: 'text' as const, text: '[Image]' }
    if (part.type === 'file') return { type: 'text' as const, text: '[File]' }
    return part
  })

  return { ...msg, content }
}

function stripToolBinary(msg: ModelMessage & { role: 'tool' }): ModelMessage {
  const content = (msg.content as ToolContent).map((part) => {
    if (part.type !== 'tool-result') return part

    const output = part.output as LanguageModelV3ToolResultOutput
    if (output.type !== 'content') return part

    const strippedValue = output.value.map((cp) => {
      if (isBinaryContentPart(cp as { type: string })) {
        const placeholder =
          (cp as { type: string }).type === 'file-data' ? '[File]' : '[Image]'
        return { type: 'text' as const, text: placeholder }
      }
      return cp
    })

    return { ...part, output: { ...output, value: strippedValue } }
  })

  return { ...msg, content } as ModelMessage
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: inherent complexity of walking nested AI SDK message types
export function countBinaryParts(messages: ModelMessage[]): number {
  let count = 0

  for (const msg of messages) {
    if (msg.role === 'user' && typeof msg.content !== 'string') {
      for (const part of msg.content) {
        if (part.type === 'image' || part.type === 'file') count++
      }
    } else if (msg.role === 'tool') {
      for (const part of msg.content as ToolContent) {
        if (part.type !== 'tool-result') continue
        const output = part.output as LanguageModelV3ToolResultOutput
        if (output.type !== 'content') continue
        for (const cp of output.value) {
          if (isBinaryContentPart(cp as { type: string })) count++
        }
      }
    }
  }

  return count
}
