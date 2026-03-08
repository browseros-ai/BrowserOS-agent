import { describe, it } from 'bun:test'
import assert from 'node:assert'
import { existsSync, unlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { close_page, new_page } from '../../src/tools/navigation'
import { save_pdf } from '../../src/tools/page-actions'
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

describe('page action tools', () => {
  it('save_pdf writes a PDF file to disk', async () => {
    await withBrowser(async ({ execute }) => {
      const newResult = await execute(new_page, { url: 'https://example.com' })
      const pageId = structuredOf<{ pageId: number }>(newResult).pageId

      const pdfPath = join(tmpdir(), `browseros-test-${Date.now()}.pdf`)

      try {
        const pdfResult = await execute(save_pdf, {
          page: pageId,
          path: pdfPath,
        })
        assert.ok(!pdfResult.isError, textOf(pdfResult))
        assert.ok(textOf(pdfResult).includes('Saved PDF'))
        const data = structuredOf<{
          action: string
          path: string
          generatedFiles: Array<{
            path: string
            mediaType: string
            sourceTool: string
            operation: string
          }>
        }>(pdfResult)
        assert.strictEqual(data.action, 'save_pdf')
        assert.strictEqual(data.path, pdfPath)
        assert.deepStrictEqual(data.generatedFiles, [
          {
            path: pdfPath,
            mediaType: 'application/pdf',
            sourceTool: 'save_pdf',
            operation: 'saved',
          },
        ])
        assert.ok(existsSync(pdfPath), 'PDF file should exist on disk')

        const stat = Bun.file(pdfPath)
        assert.ok((await stat.size) > 0, 'PDF file should not be empty')
      } finally {
        if (existsSync(pdfPath)) unlinkSync(pdfPath)
        await execute(close_page, { page: pageId })
      }
    })
  }, 60_000)
})
