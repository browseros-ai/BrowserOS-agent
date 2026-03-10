import { describe, it } from 'bun:test'
import assert from 'node:assert'
import { existsSync, readFileSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import { close_page, navigate_page, new_page } from '../../src/tools/navigation'
import {
  evaluate_script,
  get_page_content,
  get_page_links,
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

function structuredOf<T>(result: { structuredContent?: unknown }): T {
  assert.ok(result.structuredContent, 'Expected structuredContent')
  return result.structuredContent as T
}

function pageIdOf(result: {
  content: { type: string; text?: string }[]
  structuredContent?: unknown
}): number {
  const data = result.structuredContent as { pageId?: number } | undefined
  if (typeof data?.pageId === 'number') return data.pageId
  return Number(textOf(result).match(/Page ID:\s*(\d+)/)?.[1])
}

describe('observation tools', () => {
  it('take_snapshot returns element IDs', async () => {
    await withBrowser(async ({ execute }) => {
      const newResult = await execute(new_page, { url: 'about:blank' })
      const pageId = pageIdOf(newResult)
      await execute(evaluate_script, {
        page: pageId,
        expression: `
          document.body.innerHTML = '<button id="submit">Submit</button><input aria-label="Email" />';
          'done'
        `,
      })

      const snapResult = await execute(take_snapshot, { page: pageId })
      assert.ok(!snapResult.isError, textOf(snapResult))
      const text = textOf(snapResult)
      assert.ok(text.length > 0, 'Snapshot should not be empty')
      assert.ok(
        text.includes('Submit') || text.includes('button'),
        'Snapshot should include interactive element details',
      )
      const data = structuredOf<{ snapshot: string }>(snapResult)
      assert.ok(data.snapshot.length > 0, 'Expected structured snapshot')

      await execute(close_page, { page: pageId })
    })
  }, 60_000)

  it('take_enhanced_snapshot returns structural context', async () => {
    await withBrowser(async ({ execute }) => {
      const newResult = await execute(new_page, { url: 'https://example.com' })
      const pageId = pageIdOf(newResult)

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
      const pageId = pageIdOf(newResult)

      const result = await execute(take_screenshot, { page: pageId })
      assert.ok(!result.isError)

      const imageItem = result.content.find(
        (c): c is { type: 'image'; data: string; mimeType: string } =>
          c.type === 'image',
      )
      assert.ok(imageItem, 'Expected an image content item')
      assert.ok(imageItem.data.length > 0, 'Image data should not be empty')
      const data = structuredOf<{ mimeType: string }>(result)
      assert.ok(data.mimeType.startsWith('image/'))

      await execute(close_page, { page: pageId })
    })
  }, 60_000)

  it('evaluate_script returns values', async () => {
    await withBrowser(async ({ execute }) => {
      const newResult = await execute(new_page, { url: 'about:blank' })
      const pageId = pageIdOf(newResult)

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
      const pageId = pageIdOf(newResult)

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
      const pageId = pageIdOf(newResult)

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
      const pageId = pageIdOf(newResult)

      const contentResult = await execute(get_page_content, { page: pageId })
      assert.ok(!contentResult.isError, textOf(contentResult))
      const text = textOf(contentResult)
      assert.ok(text.includes('Example Domain'), 'Expected page content')
      const data = structuredOf<{
        content: string
        contentLength: number
        writtenToFile: boolean
      }>(contentResult)
      assert.strictEqual(data.writtenToFile, false)
      assert.strictEqual(data.contentLength, data.content.length)

      await execute(close_page, { page: pageId })
    })
  }, 60_000)

  it('get_page_content writes large content to disk', async () => {
    await withBrowser(async ({ execute }) => {
      const newResult = await execute(new_page, { url: 'about:blank' })
      const pageId = pageIdOf(newResult)
      let savedPath: string | undefined

      try {
        const html = Array.from(
          { length: 250 },
          (_, i) =>
            `<p>Paragraph ${i} ${'alpha beta gamma delta epsilon '.repeat(4)}</p>`,
        ).join('')
        await execute(evaluate_script, {
          page: pageId,
          expression: `document.body.innerHTML = ${JSON.stringify(`<main>${html}</main>`)}`,
        })

        const contentResult = await execute(get_page_content, { page: pageId })
        assert.ok(!contentResult.isError, textOf(contentResult))
        const data = structuredOf<{
          path: string
          contentLength: number
          writtenToFile: boolean
        }>(contentResult)
        savedPath = data.path

        assert.strictEqual(data.writtenToFile, true)
        assert.ok(textOf(contentResult).includes('Saved page content'))
        assert.ok(existsSync(savedPath), 'Saved page content file should exist')
        assert.ok(
          savedPath.startsWith(join(process.cwd(), 'tool-output')),
          'Saved page content should be written under executionDir/tool-output',
        )

        const savedContent = readFileSync(savedPath, 'utf8')
        assert.strictEqual(savedContent.length, data.contentLength)
        assert.ok(
          savedContent.includes('Paragraph 0'),
          'Saved file should contain the extracted content',
        )
      } finally {
        if (savedPath && existsSync(savedPath)) unlinkSync(savedPath)
        await execute(close_page, { page: pageId })
      }
    })
  }, 60_000)

  it('get_page_links extracts links from constructed HTML', async () => {
    await withBrowser(async ({ execute }) => {
      const newResult = await execute(new_page, { url: 'about:blank' })
      const pageId = pageIdOf(newResult)

      const html = `
        <a href="https://example.com/one">First Link</a>
        <a href="https://example.com/two">Second Link</a>
        <a href="https://example.com/three">Third Link</a>
        <a href="https://example.com/one">Duplicate Link</a>
        <a href="javascript:void(0)">JS Link</a>
        <span>Not a link</span>
      `
      await execute(evaluate_script, {
        page: pageId,
        expression: `document.body.innerHTML = ${JSON.stringify(html)}`,
      })

      // navigate forces a new AX tree fetch
      await execute(navigate_page, {
        page: pageId,
        action: 'reload',
      })

      // set body content again after reload
      await execute(evaluate_script, {
        page: pageId,
        expression: `document.body.innerHTML = ${JSON.stringify(html)}`,
      })

      const linksResult = await execute(get_page_links, { page: pageId })
      assert.ok(!linksResult.isError, textOf(linksResult))
      const text = textOf(linksResult)
      const linksData = structuredOf<{
        links: Array<{ href: string }>
        count: number
      }>(linksResult)

      assert.ok(text.includes('First Link'), 'Expected first link text')
      assert.ok(text.includes('Second Link'), 'Expected second link text')
      assert.ok(text.includes('Third Link'), 'Expected third link text')
      assert.ok(text.includes('example.com/one'), 'Expected first link URL')
      assert.ok(text.includes('example.com/two'), 'Expected second link URL')

      // should deduplicate by URL
      const oneCount = (text.match(/example\.com\/one/g) || []).length
      assert.strictEqual(oneCount, 1, 'Expected deduplication of same URL')
      assert.ok(linksData.count >= 3, 'Expected structured links count')

      // should skip javascript: links
      assert.ok(
        !text.includes('javascript:'),
        'Should not include javascript: links',
      )

      // should not include non-link elements
      assert.ok(!text.includes('Not a link'), 'Should not include spans')

      await execute(close_page, { page: pageId })
    })
  }, 60_000)

  it('get_page_links returns empty message for pages with no links', async () => {
    await withBrowser(async ({ execute }) => {
      const newResult = await execute(new_page, { url: 'about:blank' })
      const pageId = pageIdOf(newResult)

      const linksResult = await execute(get_page_links, { page: pageId })
      assert.ok(!linksResult.isError, textOf(linksResult))
      assert.ok(textOf(linksResult).includes('No links found'))
      const linksData = structuredOf<{ links: unknown[]; count: number }>(
        linksResult,
      )
      assert.strictEqual(linksData.count, 0)

      await execute(close_page, { page: pageId })
    })
  }, 60_000)
})
