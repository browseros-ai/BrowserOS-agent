import { describe, expect, it } from 'bun:test'
import type { Browser } from '../../src/browser/browser'
import { enrichToolInputWithTabId } from '../../src/tools/framework'

describe('enrichToolInputWithTabId', () => {
  const browser = {
    resolvePageIdToTabId: async (pageId: number) => {
      if (pageId === 7) return 42
      if (pageId === 8) return 84
      return undefined
    },
  } as unknown as Browser

  it('returns non-object input unchanged', async () => {
    const input = 'not-an-object'
    const result = await enrichToolInputWithTabId(input, browser)
    expect(result).toBe(input)
  })

  it('returns input unchanged when tabId is already present', async () => {
    const input = { tabId: 11, page: 7 }
    const result = await enrichToolInputWithTabId(input, browser)
    expect(result).toBe(input)
  })

  it('adds tabId when page is present', async () => {
    const input = { page: 7, element: 13 }
    const result = await enrichToolInputWithTabId(input, browser)
    expect(result).toEqual({ page: 7, element: 13, tabId: 42 })
  })

  it('adds tabId when pageId is present', async () => {
    const input = { pageId: 8 }
    const result = await enrichToolInputWithTabId(input, browser)
    expect(result).toEqual({ pageId: 8, tabId: 84 })
  })

  it('returns input unchanged when page cannot be resolved', async () => {
    const input = { page: 999 }
    const result = await enrichToolInputWithTabId(input, browser)
    expect(result).toBe(input)
  })
})
