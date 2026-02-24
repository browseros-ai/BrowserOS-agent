import { describe, it } from 'bun:test'
import assert from 'node:assert'
import {
  close_page,
  get_active_page,
  list_pages,
  navigate_page,
  new_page,
  wait_for,
} from '../../src/tools/navigation'
import { withBrowser } from '../__helpers__/with-browser'

function textOf(result: {
  content: { type: string; text?: string }[]
}): string {
  return result.content
    .filter((c) => c.type === 'text')
    .map((c) => c.text)
    .join('\n')
}

describe('navigation tools', () => {
  it('list_pages returns at least one page', async () => {
    await withBrowser(async ({ execute }) => {
      const result = await execute(list_pages, {})
      assert.ok(!result.isError, textOf(result))
      const text = textOf(result)
      assert.ok(text.length > 0, 'Expected non-empty page list')
    })
  }, 60_000)

  it('get_active_page returns the focused page', async () => {
    await withBrowser(async ({ execute }) => {
      const result = await execute(get_active_page, {})
      assert.ok(!result.isError, textOf(result))
      assert.ok(textOf(result).includes('Active page:'))
    })
  }, 60_000)

  it('new_page opens a tab and close_page removes it', async () => {
    await withBrowser(async ({ execute }) => {
      const beforeResult = await execute(list_pages, {})
      const beforeCount = textOf(beforeResult).split(/\n\n/).length

      const newResult = await execute(new_page, { url: 'about:blank' })
      assert.ok(!newResult.isError, textOf(newResult))
      const newText = textOf(newResult)
      assert.ok(newText.includes('Page ID:'), 'Expected page ID in response')

      const pageIdMatch = newText.match(/Page ID:\s*(\d+)/)
      assert.ok(pageIdMatch, 'Could not extract page ID')
      const pageId = Number(pageIdMatch?.[1])

      const afterResult = await execute(list_pages, {})
      const afterCount = textOf(afterResult).split(/\n\n/).length
      assert.ok(afterCount > beforeCount, 'Expected more pages after new_page')

      const closeResult = await execute(close_page, { page: pageId })
      assert.ok(!closeResult.isError, textOf(closeResult))
      assert.ok(textOf(closeResult).includes(`Closed page ${pageId}`))
    })
  }, 60_000)

  it('navigate_page navigates to a URL', async () => {
    await withBrowser(async ({ execute }) => {
      const newResult = await execute(new_page, { url: 'about:blank' })
      const pageId = Number(textOf(newResult).match(/Page ID:\s*(\d+)/)?.[1])

      const navResult = await execute(navigate_page, {
        page: pageId,
        action: 'url',
        url: 'https://example.com',
      })
      assert.ok(!navResult.isError, textOf(navResult))
      assert.ok(textOf(navResult).includes('Navigated to'))

      await execute(close_page, { page: pageId })
    })
  }, 60_000)

  it('wait_for finds text on page', async () => {
    await withBrowser(async ({ execute }) => {
      const newResult = await execute(new_page, { url: 'https://example.com' })
      const pageId = Number(textOf(newResult).match(/Page ID:\s*(\d+)/)?.[1])

      const waitResult = await execute(wait_for, {
        page: pageId,
        text: 'Example Domain',
        timeout: 10_000,
      })
      assert.ok(!waitResult.isError, textOf(waitResult))
      assert.ok(textOf(waitResult).includes('Found'))

      await execute(close_page, { page: pageId })
    })
  }, 60_000)

  it('wait_for times out for missing text', async () => {
    await withBrowser(async ({ execute }) => {
      const newResult = await execute(new_page, { url: 'about:blank' })
      const pageId = Number(textOf(newResult).match(/Page ID:\s*(\d+)/)?.[1])

      const waitResult = await execute(wait_for, {
        page: pageId,
        text: 'this-text-does-not-exist-anywhere',
        timeout: 2_000,
      })
      assert.ok(waitResult.isError, 'Expected timeout error')
      assert.ok(textOf(waitResult).includes('Timed out'))

      await execute(close_page, { page: pageId })
    })
  }, 60_000)
})
