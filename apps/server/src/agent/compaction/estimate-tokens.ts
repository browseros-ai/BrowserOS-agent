import type { LanguageModelV3ToolResultOutput } from '@ai-sdk/provider'
import { AGENT_LIMITS } from '@browseros/shared/constants/limits'
import type { ModelMessage } from 'ai'
import type { ComputedConfig, StepWithUsage } from './types'

function isBinaryContentPart(part: { type: string }): boolean {
  return (
    part.type === 'media' ||
    part.type === 'image-data' ||
    part.type === 'file-data'
  )
}

function estimateToolResultOutput(output: LanguageModelV3ToolResultOutput): {
  chars: number
  images: number
} {
  switch (output.type) {
    case 'text':
    case 'error-text':
      return { chars: output.value.length, images: 0 }
    case 'json':
    case 'error-json':
      return { chars: JSON.stringify(output.value).length, images: 0 }
    case 'execution-denied':
      return { chars: output.reason?.length ?? 0, images: 0 }
    case 'content': {
      let chars = 0
      let images = 0
      for (const cp of output.value) {
        if (cp.type === 'text') {
          chars += cp.text.length
        } else if (isBinaryContentPart(cp as { type: string })) {
          images++
        }
      }
      return { chars, images }
    }
    default:
      return { chars: 0, images: 0 }
  }
}

function estimateContentPart(part: Record<string, unknown>): {
  chars: number
  images: number
} {
  if ('text' in part && typeof part.text === 'string') {
    return { chars: part.text.length, images: 0 }
  }
  if ('type' in part && part.type === 'image') {
    return { chars: 0, images: 1 }
  }
  if (
    'output' in part &&
    part.output &&
    typeof part.output === 'object' &&
    'type' in (part.output as Record<string, unknown>)
  ) {
    return estimateToolResultOutput(
      part.output as LanguageModelV3ToolResultOutput,
    )
  }
  if ('input' in part) {
    return { chars: JSON.stringify(part.input).length, images: 0 }
  }
  return { chars: 0, images: 0 }
}

export function estimateTokens(
  messages: ModelMessage[],
  imageTokenEstimate: number = AGENT_LIMITS.COMPACTION_IMAGE_TOKEN_ESTIMATE,
): number {
  let chars = 0
  let imageCount = 0

  for (const msg of messages) {
    if (typeof msg.content === 'string') {
      chars += msg.content.length
    } else if (Array.isArray(msg.content)) {
      for (const part of msg.content) {
        const est = estimateContentPart(part as Record<string, unknown>)
        chars += est.chars
        imageCount += est.images
      }
    }
  }

  return Math.ceil(chars / 3) + imageCount * imageTokenEstimate
}

export function getCurrentTokenCount(
  steps: ReadonlyArray<StepWithUsage>,
  messages: ModelMessage[],
  config: ComputedConfig,
): number {
  if (steps.length > 0) {
    const lastStep = steps[steps.length - 1]
    if (lastStep.usage?.inputTokens != null && lastStep.usage.inputTokens > 0) {
      const base = lastStep.usage.inputTokens
      const outputTokens = lastStep.usage.outputTokens ?? 0

      let trailingTokens = 0
      for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i].role === 'tool') {
          trailingTokens += estimateTokens(
            [messages[i]],
            config.imageTokenEstimate,
          )
        } else {
          break
        }
      }

      return base + outputTokens + trailingTokens
    }
  }

  const estimated = estimateTokens(messages, config.imageTokenEstimate)
  return Math.ceil(estimated * config.safetyMultiplier) + config.fixedOverhead
}

/**
 * Estimate tokens directly from message content with safety margin.
 * Used after pruning/clearing when step usage is stale.
 */
export function estimateTokensForThreshold(
  messages: ModelMessage[],
  config: ComputedConfig,
): number {
  return (
    Math.ceil(
      estimateTokens(messages, config.imageTokenEstimate) *
        config.safetyMultiplier,
    ) + config.fixedOverhead
  )
}
