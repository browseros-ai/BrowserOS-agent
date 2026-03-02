import { describe, it } from 'bun:test'
import assert from 'node:assert'
import {
  delete_history_range,
  delete_history_url,
  get_recent_history,
  search_history,
} from '../../src/tools/history'
import { close_page, new_page } from '../../src/tools/navigation'
import { withBrowser } from '../__helpers__/with-browser'

function textOf(result: {
  content: { type: string; text?: string }[]
}): string {
  return result.content
    .filter((c) => c.type === 'text')
    .map((c) => c.text)
    .join('\n')
}

describe('history tools', () => {
  it('get_recent_history returns items', async () => {
    await withBrowser(async ({ execute }) => {
      // Navigate somewhere to ensure history exists
      const newResult = await execute(new_page, { url: 'https://example.com' })
      const pageId = Number(textOf(newResult).match(/Page ID:\s*(\d+)/)?.[1])

      const result = await execute(get_recent_history, { maxResults: 10 })
      assert.ok(!result.isError, textOf(result))
      const text = textOf(result)
      assert.ok(
        text.includes('history') || text.includes('Retrieved'),
        'Expected history response',
      )

      await execute(close_page, { page: pageId })
    })
  }, 60_000)

  it('search_history searches by query', async () => {
    await withBrowser(async ({ execute }) => {
      const result = await execute(search_history, {
        query: 'example',
        maxResults: 10,
      })
      assert.ok(!result.isError, textOf(result))
    })
  }, 60_000)

  it('delete_history_url removes a URL', async () => {
    await withBrowser(async ({ execute }) => {
      const result = await execute(delete_history_url, {
        url: 'https://example.com/nonexistent-test-url',
      })
      assert.ok(!result.isError, textOf(result))
      assert.ok(textOf(result).includes('Deleted'))
    })
  }, 60_000)

  it('delete_history_range deletes a time range', async () => {
    await withBrowser(async ({ execute }) => {
      const now = Date.now()
      const result = await execute(delete_history_range, {
        startTime: now - 1000,
        endTime: now,
      })
      assert.ok(!result.isError, textOf(result))
      assert.ok(textOf(result).includes('Deleted history from'))
    })
  }, 60_000)
})
