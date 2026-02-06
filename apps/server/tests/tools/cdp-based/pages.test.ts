/**
 * @license
 * Copyright 2025 BrowserOS
 */

import { describe, it } from 'bun:test'
import assert from 'node:assert'

import {
  closePage,
  handleDialog,
  listPages,
  navigatePage,
  newPage,
  resizePage,
  selectPage,
} from '../../../src/tools/cdp-based/pages'
import { CdpResponse } from '../../../src/tools/cdp-based/response'

import { withCdpBrowser } from '../../__helpers__/utils'

function pagesFromStructured(structuredContent: Record<string, unknown>) {
  const pages = structuredContent.pages
  assert.ok(Array.isArray(pages), 'Expected pages array in structuredContent')
  return pages as Array<{ id: number; url: string; selected: boolean }>
}

describe('pages', () => {
  it('list_pages - lists pages', async () => {
    await withCdpBrowser(async (_response, context) => {
      const response = new CdpResponse()
      await listPages.handler({ params: {} }, response, context)
      const result = await response.handle(listPages.name, context)
      const pages = pagesFromStructured(result.structuredContent as any)
      assert.ok(pages.length >= 1)
      assert.ok(pages.some((p) => p.selected))
    })
  })

  it('new_page - creates a page', async () => {
    await withCdpBrowser(async (_response, context) => {
      const before = new CdpResponse()
      await listPages.handler({ params: {} }, before, context)
      const beforeResult = await before.handle(listPages.name, context)
      const beforePages = pagesFromStructured(
        beforeResult.structuredContent as any,
      )

      const response = new CdpResponse()
      await newPage.handler(
        { params: { url: 'about:blank' } },
        response,
        context,
      )
      const result = await response.handle(newPage.name, context)
      const afterPages = pagesFromStructured(result.structuredContent as any)
      assert.strictEqual(afterPages.length, beforePages.length + 1)
      assert.ok(afterPages.some((p) => p.selected))
    })
  })

  it('close_page - closes a page', async () => {
    await withCdpBrowser(async (_response, context) => {
      const page = await context.newPage()
      const pageId = context.getPageId(page)
      assert.ok(typeof pageId === 'number')

      const response = new CdpResponse()
      await closePage.handler({ params: { pageId } }, response, context)
      await response.handle(closePage.name, context)
      assert.ok(page.isClosed())
    })
  })

  it('select_page - selects a page', async () => {
    await withCdpBrowser(async (_response, context) => {
      const second = await context.newPage()
      const pages = context.getPages()
      assert.ok(pages.length >= 2)
      const firstId = context.getPageId(pages[0])
      assert.ok(typeof firstId === 'number')

      assert.ok(context.isPageSelected(second))

      const response = new CdpResponse()
      await selectPage.handler(
        { params: { pageId: firstId } },
        response,
        context,
      )
      const result = await response.handle(selectPage.name, context)
      const pageData = pagesFromStructured(result.structuredContent as any)
      assert.ok(pageData.find((p) => p.id === firstId)?.selected)
    })
  })

  it('navigate_page - navigates to correct page', async () => {
    await withCdpBrowser(async (_response, context) => {
      const response = new CdpResponse()
      await navigatePage.handler(
        { params: { url: 'data:text/html,<div>Hello MCP</div>' } },
        response,
        context,
      )
      await response.handle(navigatePage.name, context)
      const page = context.getSelectedPage()
      assert.equal(
        await page.evaluate(() => document.querySelector('div')?.textContent),
        'Hello MCP',
      )
    })
  })

  it('navigate_page - go back and forward', async () => {
    await withCdpBrowser(async (_response, context) => {
      const page = context.getSelectedPage()
      await page.goto('data:text/html,<div>Hello</div>')

      {
        const response = new CdpResponse()
        await navigatePage.handler(
          { params: { type: 'back' } },
          response,
          context,
        )
        await response.handle(navigatePage.name, context)
        assert.equal(
          await page.evaluate(() => document.location.href),
          'about:blank',
        )
      }

      {
        const response = new CdpResponse()
        await navigatePage.handler(
          { params: { type: 'forward' } },
          response,
          context,
        )
        await response.handle(navigatePage.name, context)
        assert.equal(
          await page.evaluate(() => document.querySelector('div')?.textContent),
          'Hello',
        )
      }
    })
  })

  it('resize_page - sets viewport size', async () => {
    await withCdpBrowser(async (_response, context) => {
      const response = new CdpResponse()
      await resizePage.handler(
        { params: { width: 700, height: 500 } },
        response,
        context,
      )
      await response.handle(resizePage.name, context)
      const page = context.getSelectedPage()
      const dimensions = await page.evaluate(() => {
        return [window.innerWidth, window.innerHeight]
      })
      assert.deepStrictEqual(dimensions, [700, 500])
    })
  })

  it('handle_dialog - can accept dialogs', async () => {
    await withCdpBrowser(async (_response, context) => {
      const page = context.getSelectedPage()
      const dialogPromise = new Promise<void>((resolve) => {
        page.on('dialog', () => resolve())
      })
      void page.evaluate(() => {
        alert('test')
      })
      await dialogPromise

      const response = new CdpResponse()
      await handleDialog.handler(
        { params: { action: 'accept' } },
        response,
        context,
      )
      const result = await response.handle(handleDialog.name, context)
      const message = String(result.structuredContent.message ?? '')
      assert.ok(message.includes('Successfully accepted the dialog'))
    })
  })
})
