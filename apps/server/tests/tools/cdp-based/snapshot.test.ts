/**
 * @license
 * Copyright 2025 BrowserOS
 */

import { describe, it } from 'bun:test'
import assert from 'node:assert'
import { CdpResponse } from '../../../src/tools/cdp-based/response/cdp-response'
import {
  takeSnapshot,
  waitFor,
} from '../../../src/tools/cdp-based/tools/snapshot'

import { html, withCdpBrowser } from '../../__helpers__/utils'

describe('snapshot', () => {
  it('take_snapshot - includes a snapshot', async () => {
    await withCdpBrowser(async (_response, context) => {
      const response = new CdpResponse()
      await takeSnapshot.handler({ params: {} }, response, context)
      const result = await response.handle(takeSnapshot.name, context)
      assert.ok(
        result.structuredContent.snapshot,
        'Expected snapshot in structuredContent',
      )
    })
  })

  it('wait_for - should work', async () => {
    await withCdpBrowser(async (_response, context) => {
      const page = await context.getSelectedPage()

      await page.setContent(
        html`<main><span>Hello</span><span> </span><div>World</div></main>`,
      )

      const response = new CdpResponse()
      await waitFor.handler({ params: { text: 'Hello' } }, response, context)
      const result = await response.handle(waitFor.name, context)
      const message = String(result.structuredContent.message ?? '')
      assert.ok(message.includes('Element with text "Hello" found.'), message)
      assert.ok(
        result.structuredContent.snapshot,
        'Expected snapshot in structuredContent',
      )
    })
  })

  it('wait_for - works when element shows up later', async () => {
    await withCdpBrowser(async (_response, context) => {
      const page = context.getSelectedPage()

      const response = new CdpResponse()
      const handlePromise = waitFor.handler(
        { params: { text: 'Hello World' } },
        response,
        context,
      )

      await page.setContent(
        html`<main><span>Hello</span><span> </span><div>World</div></main>`,
      )

      await handlePromise

      const result = await response.handle(waitFor.name, context)
      const message = String(result.structuredContent.message ?? '')
      assert.ok(
        message.includes('Element with text "Hello World" found.'),
        message,
      )
      assert.ok(
        result.structuredContent.snapshot,
        'Expected snapshot in structuredContent',
      )
    })
  })

  it('wait_for - works with aria elements', async () => {
    await withCdpBrowser(async (_response, context) => {
      const page = context.getSelectedPage()

      await page.setContent(html`<main><h1>Header</h1><div>Text</div></main>`)

      const response = new CdpResponse()
      await waitFor.handler({ params: { text: 'Header' } }, response, context)
      const result = await response.handle(waitFor.name, context)
      const message = String(result.structuredContent.message ?? '')
      assert.ok(message.includes('Element with text "Header" found.'), message)
      assert.ok(
        result.structuredContent.snapshot,
        'Expected snapshot in structuredContent',
      )
    })
  })

  it('wait_for - works with iframe content', async () => {
    await withCdpBrowser(async (_response, context) => {
      const page = await context.getSelectedPage()

      await page.setContent(
        html`<h1>Top level</h1>
          <iframe srcdoc="<p>Hello iframe</p>"></iframe>`,
      )

      const response = new CdpResponse()
      await waitFor.handler(
        { params: { text: 'Hello iframe' } },
        response,
        context,
      )
      const result = await response.handle(waitFor.name, context)
      const message = String(result.structuredContent.message ?? '')
      assert.ok(
        message.includes('Element with text "Hello iframe" found.'),
        message,
      )
      assert.ok(
        result.structuredContent.snapshot,
        'Expected snapshot in structuredContent',
      )
    })
  })
})
