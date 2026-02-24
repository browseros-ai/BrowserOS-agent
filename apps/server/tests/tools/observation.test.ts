import { describe, it } from 'bun:test'
import assert from 'node:assert'
import { close_page, new_page } from '../../src/tools/navigation'
import {
  evaluate_script,
  get_page_content,
  take_enhanced_snapshot,
  take_screenshot,
  take_snapshot,
} from '../../src/tools/snapshot'
import { withBrowser } from '../__helpers__/with-browser'

function textOf(result: {
  content: { type: string; text?: string }[]
}): string {
  return result.content
    .filter((c) => c.type === 'text')
    .map((c) => c.text)
    .join('\n')
}

describe('observation tools', () => {
  it('take_snapshot returns element IDs', async () => {
    await withBrowser(async ({ execute }) => {
      const newResult = await execute(new_page, { url: 'https://example.com' })
      const pageId = Number(textOf(newResult).match(/Page ID:\s*(\d+)/)?.[1])

      const snapResult = await execute(take_snapshot, { page: pageId })
      assert.ok(!snapResult.isError, textOf(snapResult))
      const text = textOf(snapResult)
      assert.ok(text.length > 0, 'Snapshot should not be empty')

      await execute(close_page, { page: pageId })
    })
  }, 60_000)

  it('take_enhanced_snapshot returns structural context', async () => {
    await withBrowser(async ({ execute }) => {
      const newResult = await execute(new_page, { url: 'https://example.com' })
      const pageId = Number(textOf(newResult).match(/Page ID:\s*(\d+)/)?.[1])

      const snapResult = await execute(take_enhanced_snapshot, { page: pageId })
      assert.ok(!snapResult.isError, textOf(snapResult))
      const text = textOf(snapResult)
      assert.ok(text.length > 0, 'Enhanced snapshot should not be empty')

      await execute(close_page, { page: pageId })
    })
  }, 60_000)

  it('take_screenshot returns an image', async () => {
    await withBrowser(async ({ execute }) => {
      const newResult = await execute(new_page, { url: 'https://example.com' })
      const pageId = Number(textOf(newResult).match(/Page ID:\s*(\d+)/)?.[1])

      const result = await execute(take_screenshot, { page: pageId })
      assert.ok(!result.isError)

      const imageItem = result.content.find(
        (c): c is { type: 'image'; data: string; mimeType: string } =>
          c.type === 'image',
      )
      assert.ok(imageItem, 'Expected an image content item')
      assert.ok(imageItem.data.length > 0, 'Image data should not be empty')

      await execute(close_page, { page: pageId })
    })
  }, 60_000)

  it('evaluate_script returns values', async () => {
    await withBrowser(async ({ execute }) => {
      const newResult = await execute(new_page, { url: 'about:blank' })
      const pageId = Number(textOf(newResult).match(/Page ID:\s*(\d+)/)?.[1])

      const evalResult = await execute(evaluate_script, {
        page: pageId,
        expression: '2 + 2',
      })
      assert.ok(!evalResult.isError, textOf(evalResult))
      assert.ok(textOf(evalResult).includes('4'))

      await execute(close_page, { page: pageId })
    })
  }, 60_000)

  it('evaluate_script returns strings', async () => {
    await withBrowser(async ({ execute }) => {
      const newResult = await execute(new_page, { url: 'about:blank' })
      const pageId = Number(textOf(newResult).match(/Page ID:\s*(\d+)/)?.[1])

      const evalResult = await execute(evaluate_script, {
        page: pageId,
        expression: '"hello world"',
      })
      assert.ok(!evalResult.isError, textOf(evalResult))
      assert.strictEqual(textOf(evalResult), 'hello world')

      await execute(close_page, { page: pageId })
    })
  }, 60_000)

  it('evaluate_script reports errors', async () => {
    await withBrowser(async ({ execute }) => {
      const newResult = await execute(new_page, { url: 'about:blank' })
      const pageId = Number(textOf(newResult).match(/Page ID:\s*(\d+)/)?.[1])

      const evalResult = await execute(evaluate_script, {
        page: pageId,
        expression: 'throw new Error("test error")',
      })
      assert.ok(evalResult.isError, 'Expected error result')
      assert.ok(textOf(evalResult).includes('test error'))

      await execute(close_page, { page: pageId })
    })
  }, 60_000)

  it('get_page_content returns markdown text', async () => {
    await withBrowser(async ({ execute }) => {
      const newResult = await execute(new_page, { url: 'https://example.com' })
      const pageId = Number(textOf(newResult).match(/Page ID:\s*(\d+)/)?.[1])

      const contentResult = await execute(get_page_content, { page: pageId })
      assert.ok(!contentResult.isError, textOf(contentResult))
      const text = textOf(contentResult)
      assert.ok(text.includes('Example Domain'), 'Expected page content')

      await execute(close_page, { page: pageId })
    })
  }, 60_000)
})
