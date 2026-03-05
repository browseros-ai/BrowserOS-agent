import { describe, it } from 'bun:test'
import assert from 'node:assert'
import type { Browser } from '../../src/browser/browser'
import { ToolResponse } from '../../src/tools/response'

function textOf(result: {
  content: { type: string; text?: string }[]
}): string {
  return result.content
    .filter((item) => item.type === 'text')
    .map((item) => item.text)
    .join('\n')
}

describe('ToolResponse', () => {
  it('accumulates structured content from data()', () => {
    const response = new ToolResponse()
    response.data('action', 'click')
    response.data({ page: 1, element: 42 })

    const result = response.toResult()
    assert.deepStrictEqual(result.structuredContent, {
      action: 'click',
      page: 1,
      element: 42,
    })
  })

  it('overwrites keys on repeated data() writes', () => {
    const response = new ToolResponse()
    response.data('count', 1)
    response.data({ count: 2 })
    response.data('count', 3)

    const result = response.toResult()
    assert.deepStrictEqual(result.structuredContent, { count: 3 })
  })

  it('times out slow post-actions without failing tool output', async () => {
    const response = new ToolResponse({ postActionTimeoutMs: 25 })
    response.text('ok')
    response.includeSnapshot(1)

    const browser = {
      snapshot: async () => await new Promise<string>(() => {}),
    } as unknown as Browser

    const start = Date.now()
    const result = await response.build(browser)
    const elapsed = Date.now() - start

    assert.ok(elapsed < 250, `Expected fast timeout, got ${elapsed}ms`)
    assert.ok(!result.isError)

    const text = textOf(result)
    assert.ok(text.includes('ok'))
    assert.ok(!text.includes('[Page 1 snapshot]'))
  })

  it('includes snapshot output when post-action completes in time', async () => {
    const response = new ToolResponse({ postActionTimeoutMs: 200 })
    response.text('ok')
    response.includeSnapshot(1)

    const browser = {
      snapshot: async () => '[42] button "Submit"',
    } as unknown as Browser

    const result = await response.build(browser)
    const text = textOf(result)

    assert.ok(text.includes('ok'))
    assert.ok(text.includes('[Page 1 snapshot]'))
    assert.ok(text.includes('[42] button "Submit"'))
  })
})
