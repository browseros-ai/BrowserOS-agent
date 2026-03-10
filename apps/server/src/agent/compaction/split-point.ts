import { AGENT_LIMITS } from '@browseros/shared/constants/limits'
import type { ModelMessage } from 'ai'
import { estimateTokens } from './estimate-tokens'
import type { SplitPointResult } from './types'

export function findSafeSplitPoint(
  messages: ModelMessage[],
  keepRecentTokens: number,
  imageTokenEstimate: number = AGENT_LIMITS.COMPACTION_IMAGE_TOKEN_ESTIMATE,
): SplitPointResult {
  const noSplit: SplitPointResult = {
    splitIndex: -1,
    turnStartIndex: -1,
    isSplitTurn: false,
  }

  if (messages.length <= 2) return noSplit

  let accumulated = 0
  let candidateIndex = -1

  for (let i = messages.length - 1; i >= 0; i--) {
    accumulated += estimateTokens([messages[i]], imageTokenEstimate)

    if (accumulated >= keepRecentTokens) {
      candidateIndex = i
      break
    }
  }

  if (candidateIndex === -1) return noSplit

  while (candidateIndex > 0 && messages[candidateIndex].role === 'tool') {
    candidateIndex--
  }

  if (candidateIndex <= 0) return noSplit

  if (messages[candidateIndex].role === 'user') {
    return {
      splitIndex: candidateIndex,
      turnStartIndex: -1,
      isSplitTurn: false,
    }
  }

  let turnStart = -1
  for (let i = candidateIndex - 1; i >= 0; i--) {
    if (messages[i].role === 'user') {
      turnStart = i
      break
    }
  }

  if (turnStart <= 0) {
    return {
      splitIndex: candidateIndex,
      turnStartIndex: -1,
      isSplitTurn: false,
    }
  }

  return {
    splitIndex: candidateIndex,
    turnStartIndex: turnStart,
    isSplitTurn: true,
  }
}
