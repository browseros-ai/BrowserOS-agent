import { describe, it } from 'bun:test'
import assert from 'node:assert'
import { existsSync, unlinkSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Browser } from '../../src/browser/browser'
import { executeTool, type ToolContext } from '../../src/tools/framework'
import { close_page, new_page } from '../../src/tools/navigation'
import {
  download_file,
  save_pdf,
  save_screenshot,
} from '../../src/tools/page-actions'
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

function createToolContext(
  browser: Browser,
  executionDir: string,
  resourcesDir?: string,
): ToolContext {
  return {
    browser,
    directories: {
      executionDir,
      resourcesDir,
    },
  }
}

function createBrowserStub(methods: Record<string, unknown>): Browser {
  return {
    getTabIdForPage: () => undefined,
    ...methods,
  } as unknown as Browser
}

describe('page action tools', () => {
  it('save_pdf resolves relative paths against the execution directory by default', async () => {
    const executionDir = await mkdtemp(
      join(tmpdir(), 'browseros-page-actions-'),
    )
    const browser = createBrowserStub({
      printToPDF: async () => ({
        data: Buffer.from('pdf-data').toString('base64'),
      }),
    })

    try {
      const result = await executeTool(
        save_pdf,
        { page: 1, path: 'report.pdf' },
        createToolContext(browser, executionDir),
        AbortSignal.timeout(1_000),
      )

      assert.ok(!result.isError, textOf(result))
      const outputPath = join(executionDir, 'report.pdf')
      assert.strictEqual(
        structuredOf<{ path: string }>(result).path,
        outputPath,
      )
      assert.ok(existsSync(outputPath), 'PDF file should exist in executionDir')
    } finally {
      await rm(executionDir, { recursive: true, force: true })
    }
  })

  it('save_screenshot still honors an explicit cwd override', async () => {
    const executionDir = await mkdtemp(
      join(tmpdir(), 'browseros-page-actions-'),
    )
    const overrideDir = await mkdtemp(join(tmpdir(), 'browseros-page-actions-'))
    const browser = createBrowserStub({
      screenshot: async () => ({
        data: Buffer.from('image-data').toString('base64'),
      }),
    })

    try {
      const result = await executeTool(
        save_screenshot,
        { page: 1, path: 'capture.png', cwd: overrideDir },
        createToolContext(browser, executionDir),
        AbortSignal.timeout(1_000),
      )

      assert.ok(!result.isError, textOf(result))
      const outputPath = join(overrideDir, 'capture.png')
      assert.strictEqual(
        structuredOf<{ path: string }>(result).path,
        outputPath,
      )
      assert.ok(
        existsSync(outputPath),
        'Screenshot should exist in overrideDir',
      )
      assert.ok(
        !existsSync(join(executionDir, 'capture.png')),
        'Execution directory should not be used when cwd is provided',
      )
    } finally {
      await rm(executionDir, { recursive: true, force: true })
      await rm(overrideDir, { recursive: true, force: true })
    }
  })

  it('download_file resolves relative directories against the execution directory by default', async () => {
    const baseDir = await mkdtemp(join(tmpdir(), 'browseros-page-actions-'))
    const executionDir = join(baseDir, 'execution')
    let stagingDir: string | undefined
    const browser = createBrowserStub({
      downloadViaClick: async (
        _page: number,
        _element: number,
        tempDir: string,
      ) => {
        stagingDir = tempDir
        const filePath = join(tempDir, 'download.txt')
        await Bun.write(filePath, 'hello')
        return {
          filePath,
          suggestedFilename: 'download.txt',
        }
      },
    })

    try {
      const result = await executeTool(
        download_file,
        { page: 1, element: 7, path: '.' },
        createToolContext(browser, executionDir),
        AbortSignal.timeout(1_000),
      )

      assert.ok(!result.isError, textOf(result))
      const outputPath = join(executionDir, 'download.txt')
      const structured = structuredOf<{
        directory: string
        destinationPath: string
      }>(result)
      assert.strictEqual(structured.directory, executionDir)
      assert.strictEqual(structured.destinationPath, outputPath)
      assert.ok(existsSync(outputPath), 'Download should land in executionDir')
      assert.ok(stagingDir, 'Download should use a staging directory')
      assert.ok(
        stagingDir.startsWith(join(executionDir, 'browseros-dl-')),
        'Staging directory should be created inside executionDir',
      )
      assert.ok(
        !existsSync(stagingDir),
        'Staging directory should be removed after the download completes',
      )
    } finally {
      await rm(baseDir, { recursive: true, force: true })
    }
  })

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
        const data = structuredOf<{ action: string; path: string }>(pdfResult)
        assert.strictEqual(data.action, 'save_pdf')
        assert.strictEqual(data.path, pdfPath)
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
