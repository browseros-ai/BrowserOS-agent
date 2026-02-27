import type { UIMessageChunk } from 'ai'
import type { Browser } from '../../browser/browser'
import { enrichToolInputWithTabId } from '../../tools/framework'

type ToolInputAvailableChunk = UIMessageChunk & {
  type: 'tool-input-available'
  input?: unknown
}

function isToolInputAvailableChunk(
  chunk: UIMessageChunk,
): chunk is ToolInputAvailableChunk {
  return chunk.type === 'tool-input-available'
}

export async function enrichToolInputChunkForGlow(
  chunk: UIMessageChunk,
  browser: Browser,
): Promise<UIMessageChunk> {
  if (!isToolInputAvailableChunk(chunk)) {
    return chunk
  }

  const enrichedInput = await enrichToolInputWithTabId(chunk.input, browser)
  if (enrichedInput === chunk.input) {
    return chunk
  }

  return { ...chunk, input: enrichedInput } as UIMessageChunk
}
