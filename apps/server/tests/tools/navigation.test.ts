import { describe, it } from 'bun:test'
import assert from 'node:assert'
import {
  close_page,
  get_active_page,
  list_pages,
  move_page,
  navigate_page,
  new_hidden_page,
  new_page,
  show_page,
  wait_for,
} from '../../src/tools/navigation'
import { close_window, create_window } from '../../src/tools/windows'
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

  it('new_hidden_page opens a hidden tab', async () => {
    await withBrowser(async ({ execute }) => {
      const result = await execute(new_hidden_page, {
        url: 'about:blank',
      })
      assert.ok(!result.isError, textOf(result))
      const text = textOf(result)
      assert.ok(text.includes('Opened hidden page'), 'Expected hidden page')
      assert.ok(text.includes('Page ID:'), 'Expected page ID')

      const pageId = Number(text.match(/Page ID:\s*(\d+)/)?.[1])
      await execute(close_page, { page: pageId })
    })
  }, 60_000)

  it('show_page restores a hidden page to visible', async () => {
    await withBrowser(async ({ execute }) => {
      const hiddenResult = await execute(new_hidden_page, {
        url: 'about:blank',
      })
      const pageId = Number(textOf(hiddenResult).match(/Page ID:\s*(\d+)/)?.[1])

      const showResult = await execute(show_page, { page: pageId })
      assert.ok(!showResult.isError, textOf(showResult))
      assert.ok(textOf(showResult).includes('now visible'))

      await execute(close_page, { page: pageId })
    })
  }, 60_000)

  it('show_page errors on an already-visible page', async () => {
    await withBrowser(async ({ execute }) => {
      const newResult = await execute(new_page, { url: 'about:blank' })
      const pageId = Number(textOf(newResult).match(/Page ID:\s*(\d+)/)?.[1])

      const showResult = await execute(show_page, { page: pageId })
      assert.ok(showResult.isError, 'Expected error for visible page')

      await execute(close_page, { page: pageId })
    })
  }, 60_000)

  it('move_page moves a tab to a different window', async () => {
    await withBrowser(async ({ execute }) => {
      const newResult = await execute(new_page, { url: 'about:blank' })
      const pageId = Number(textOf(newResult).match(/Page ID:\s*(\d+)/)?.[1])

      const winResult = await execute(create_window, {})
      const windowId = Number(
        textOf(winResult).match(/Created window\s+(\d+)/)?.[1],
      )

      const moveResult = await execute(move_page, {
        page: pageId,
        windowId,
      })
      assert.ok(!moveResult.isError, textOf(moveResult))
      assert.ok(textOf(moveResult).includes('Moved page'))
      assert.ok(textOf(moveResult).includes(`window ${windowId}`))

      await execute(close_page, { page: pageId })
      await execute(close_window, { windowId })
    })
  }, 60_000)
})
