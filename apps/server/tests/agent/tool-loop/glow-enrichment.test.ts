import { describe, expect, it } from 'bun:test'
import type { UIMessageChunk } from 'ai'
import { enrichToolInputChunkForGlow } from '../../../src/agent/tool-loop/glow-enrichment'
import type { Browser } from '../../../src/browser/browser'

describe('enrichToolInputChunkForGlow', () => {
  const browser = {
    resolvePageIdToTabId: async (pageId: number) => {
      if (pageId === 5) return 99
      return undefined
    },
  } as unknown as Browser

  it('returns non-tool-input chunk unchanged', async () => {
    const chunk = {
      type: 'text-delta',
      id: '0',
      delta: 'hello',
    } as UIMessageChunk

    const result = await enrichToolInputChunkForGlow(chunk, browser)
    expect(result).toBe(chunk)
  })

  it('enriches tool-input-available chunk with tabId from page', async () => {
    const chunk = {
      type: 'tool-input-available',
      toolCallId: 'call_1',
      toolName: 'click',
      input: { page: 5, element: 12 },
    } as UIMessageChunk

    const result = await enrichToolInputChunkForGlow(chunk, browser)
    expect(result).toEqual({
      type: 'tool-input-available',
      toolCallId: 'call_1',
      toolName: 'click',
      input: { page: 5, element: 12, tabId: 99 },
    })
  })

  it('keeps chunk unchanged when tabId already exists', async () => {
    const chunk = {
      type: 'tool-input-available',
      toolCallId: 'call_2',
      toolName: 'click',
      input: { tabId: 7, page: 5 },
    } as UIMessageChunk

    const result = await enrichToolInputChunkForGlow(chunk, browser)
    expect(result).toBe(chunk)
  })

  it('keeps chunk unchanged when page cannot be resolved', async () => {
    const chunk = {
      type: 'tool-input-available',
      toolCallId: 'call_3',
      toolName: 'click',
      input: { page: 404 },
    } as UIMessageChunk

    const result = await enrichToolInputChunkForGlow(chunk, browser)
    expect(result).toBe(chunk)
  })
})
