/**
 * @license
 * Copyright 2025 BrowserOS
 */

import { describe, it } from 'bun:test'
import assert from 'node:assert'
import { CdpResponse } from '../../../src/tools/cdp-based/response/cdp-response'
import { evaluateScript } from '../../../src/tools/cdp-based/tools/script'

import { html, withCdpBrowser } from '../../__helpers__/utils'

function getJsonResultFromMessage(message: string): unknown {
  const lines = message.split('\n')
  const jsonLine = lines[2]
  assert.ok(jsonLine, 'Expected JSON result line in response message')
  return JSON.parse(jsonLine)
}

// biome-ignore lint/suspicious/noExplicitAny: test helper
function findUidByName(context: any, name: string): string {
  const snapshot = context.getTextSnapshot?.()
  assert.ok(snapshot, 'Expected text snapshot to be available')
  for (const node of snapshot.idToNode.values()) {
    if (node?.name === name) {
      return node.id
    }
  }
  throw new Error(`No node found in snapshot with name "${name}"`)
}

describe('script', () => {
  it('browser_evaluate_script - evaluates', async () => {
    await withCdpBrowser(async (_response, context) => {
      const response = new CdpResponse()
      await evaluateScript.handler(
        { params: { function: String(() => 2 * 5) } },
        response,
        context,
      )
      const result = await response.handle(evaluateScript.name, context)
      const message = String(result.structuredContent.message ?? '')
      assert.strictEqual(getJsonResultFromMessage(message), 10)
    })
  })

  it('browser_evaluate_script - runs in selected page', async () => {
    await withCdpBrowser(async (_response, context) => {
      {
        const response = new CdpResponse()
        await evaluateScript.handler(
          { params: { function: String(() => document.title) } },
          response,
          context,
        )
        const result = await response.handle(evaluateScript.name, context)
        const message = String(result.structuredContent.message ?? '')
        assert.strictEqual(getJsonResultFromMessage(message), '')
      }

      const page = await context.newPage()
      await page.setContent(`
        <head>
          <title>New Page</title>
        </head>
      `)

      {
        const response = new CdpResponse()
        await evaluateScript.handler(
          { params: { function: String(() => document.title) } },
          response,
          context,
        )
        const result = await response.handle(evaluateScript.name, context)
        const message = String(result.structuredContent.message ?? '')
        assert.strictEqual(getJsonResultFromMessage(message), 'New Page')
      }
    })
  })

  it('browser_evaluate_script - work for complex objects', async () => {
    await withCdpBrowser(async (_response, context) => {
      const page = context.getSelectedPage()
      await page.setContent(html`<script src="./scripts.js"></script> `)

      const response = new CdpResponse()
      await evaluateScript.handler(
        {
          params: {
            function: String(() => {
              const scripts = Array.from(
                document.head.querySelectorAll('script'),
              ).map((s) => ({ src: s.src, async: s.async, defer: s.defer }))

              return { scripts }
            }),
          },
        },
        response,
        context,
      )
      const result = await response.handle(evaluateScript.name, context)
      const message = String(result.structuredContent.message ?? '')
      assert.deepEqual(getJsonResultFromMessage(message), { scripts: [] })
    })
  })

  it('browser_evaluate_script - work for async functions', async () => {
    await withCdpBrowser(async (_response, context) => {
      const page = context.getSelectedPage()
      await page.setContent(html`<script src="./scripts.js"></script> `)

      const response = new CdpResponse()
      await evaluateScript.handler(
        {
          params: {
            function: String(async () => {
              await new Promise((res) => setTimeout(res, 0))
              return 'Works'
            }),
          },
        },
        response,
        context,
      )
      const result = await response.handle(evaluateScript.name, context)
      const message = String(result.structuredContent.message ?? '')
      assert.strictEqual(getJsonResultFromMessage(message), 'Works')
    })
  })

  it('browser_evaluate_script - work with one argument', async () => {
    await withCdpBrowser(async (_response, context) => {
      const page = context.getSelectedPage()
      await page.setContent(
        html`<button id="test" aria-label="test">test</button>`,
      )

      await context.createTextSnapshot()
      const uid = findUidByName(context, 'test')

      const response = new CdpResponse()
      await evaluateScript.handler(
        {
          params: {
            function: String((element: HTMLElement) => element.id),
            args: [{ uid }],
          },
        },
        response,
        context,
      )
      const result = await response.handle(evaluateScript.name, context)
      const message = String(result.structuredContent.message ?? '')
      assert.strictEqual(getJsonResultFromMessage(message), 'test')
    })
  })

  it('browser_evaluate_script - work with multiple element args', async () => {
    await withCdpBrowser(async (_response, context) => {
      const page = context.getSelectedPage()
      await page.setContent(
        html`<div id="a" aria-label="a">a</div><div id="b" aria-label="b">b</div>`,
      )
      await context.createTextSnapshot()
      const uidA = findUidByName(context, 'a')
      const uidB = findUidByName(context, 'b')

      const response = new CdpResponse()
      await evaluateScript.handler(
        {
          params: {
            function: String((a: HTMLElement, b: HTMLElement) => a.id + b.id),
            args: [{ uid: uidA }, { uid: uidB }],
          },
        },
        response,
        context,
      )
      const result = await response.handle(evaluateScript.name, context)
      const message = String(result.structuredContent.message ?? '')
      assert.strictEqual(getJsonResultFromMessage(message), 'ab')
    })
  })
})
