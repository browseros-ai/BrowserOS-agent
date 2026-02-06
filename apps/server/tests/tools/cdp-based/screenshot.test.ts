/**
 * @license
 * Copyright 2025 BrowserOS
 */

import { describe, it } from 'bun:test'
import assert from 'node:assert'
import fs from 'node:fs/promises'
import path from 'node:path'
import { CdpResponse } from '../../../src/tools/cdp-based/response'
import { screenshot } from '../../../src/tools/cdp-based/screenshot'

import { html, withCdpBrowser } from '../../__helpers__/utils'

describe('screenshot', () => {
  it('take_screenshot - returns an image by default', async () => {
    await withCdpBrowser(async (_response, context) => {
      const page = context.getSelectedPage()
      await page.setContent(html`<main><h1>Hello</h1></main>`)

      const response = new CdpResponse()
      await screenshot.handler({ params: { format: 'png' } }, response, context)
      const result = await response.handle(screenshot.name, context)

      assert.ok(result.content.length >= 2)
      // biome-ignore lint/suspicious/noExplicitAny: test code
      const image = result.content.find((c) => c.type === 'image') as any
      assert.ok(image)
      assert.equal(image.mimeType, 'image/png')
      assert.ok(typeof image.data === 'string' && image.data.length > 0)
    })
  })

  it('take_screenshot - saves to filePath', async () => {
    await withCdpBrowser(async (_response, context) => {
      const page = context.getSelectedPage()
      await page.setContent(html`<main><h1>Hello</h1></main>`)

      const outDir = await fs.mkdtemp(path.join(process.cwd(), 'tmp-shot-'))
      const outFile = path.join(outDir, 'test-screenshot.png')

      const response = new CdpResponse()
      await screenshot.handler(
        { params: { filePath: outFile } },
        response,
        context,
      )
      const result = await response.handle(screenshot.name, context)
      const message = String(result.structuredContent.message ?? '')
      assert.ok(message.includes('Saved screenshot to'), message)

      const stat = await fs.stat(outFile)
      assert.ok(stat.size > 0)
    })
  })
})
