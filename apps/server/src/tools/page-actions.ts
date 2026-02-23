import { mkdtemp, rename, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { z } from 'zod'
import { defineTool } from './framework'

const pageParam = z.number().describe('Page ID (from list_pages)')
const elementParam = z
  .number()
  .describe('Element ID from snapshot (the number in [N])')

export const save_pdf = defineTool({
  name: 'save_pdf',
  description: 'Save the current page as a PDF file',
  input: z.object({
    page: pageParam,
    path: z.string().describe('File path for the PDF (e.g. "report.pdf")'),
    cwd: z
      .string()
      .optional()
      .describe('Working directory to resolve relative paths against'),
  }),
  handler: async (args, ctx, response) => {
    const resolvedPath = resolve(args.cwd ?? process.cwd(), args.path)
    const { data } = await ctx.browser.printToPDF(args.page)
    await Bun.write(resolvedPath, Buffer.from(data, 'base64'))
    response.text(`Saved PDF to ${resolvedPath}`)
  },
})

export const download_file = defineTool({
  name: 'download_file',
  description:
    'Click an element to trigger a file download and save it to disk',
  input: z.object({
    page: pageParam,
    element: elementParam.describe('Element ID that triggers the download'),
    path: z.string().describe('Directory to save the downloaded file into'),
    cwd: z
      .string()
      .optional()
      .describe('Working directory to resolve relative paths against'),
  }),
  handler: async (args, ctx, response) => {
    const resolvedDir = resolve(args.cwd ?? process.cwd(), args.path)
    const tempDir = await mkdtemp(join(tmpdir(), 'browseros-dl-'))

    try {
      const { filePath, suggestedFilename } =
        await ctx.browser.downloadViaClick(args.page, args.element, tempDir)

      const destPath = join(resolvedDir, suggestedFilename)
      await rename(filePath, destPath)

      response.text(`Downloaded "${suggestedFilename}" to ${destPath}`)
    } finally {
      await rm(tempDir, { recursive: true, force: true }).catch(() => {})
    }
  },
})
