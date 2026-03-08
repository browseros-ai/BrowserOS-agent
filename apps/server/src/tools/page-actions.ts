import { mkdtemp, rename, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import {
  type GeneratedFile,
  GeneratedFilesSchema,
} from '@browseros/shared/generated-files'
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
  output: z.object({
    action: z.literal('save_pdf'),
    generatedFiles: GeneratedFilesSchema,
    page: z.number(),
    path: z.string(),
  }),
  handler: async (args, ctx, response) => {
    const resolvedPath = resolve(args.cwd ?? process.cwd(), args.path)
    const { data } = await ctx.browser.printToPDF(args.page)
    await Bun.write(resolvedPath, Buffer.from(data, 'base64'))
    const generatedFiles: GeneratedFile[] = [
      {
        path: resolvedPath,
        mediaType: 'application/pdf',
        sourceTool: 'save_pdf',
        operation: 'saved',
      },
    ]
    response.text(`Saved PDF to ${resolvedPath}`)
    response.data({
      action: 'save_pdf',
      generatedFiles,
      page: args.page,
      path: resolvedPath,
    })
  },
})

export const save_screenshot = defineTool({
  name: 'save_screenshot',
  description: 'Take a screenshot of a page and save it to a file on disk',
  input: z.object({
    page: pageParam,
    path: z
      .string()
      .describe('File path for the screenshot (e.g. "screenshot.png")'),
    cwd: z
      .string()
      .optional()
      .describe('Working directory to resolve relative paths against'),
    format: z
      .enum(['png', 'jpeg', 'webp'])
      .default('png')
      .describe('Image format'),
    quality: z
      .number()
      .min(0)
      .max(100)
      .optional()
      .describe('Compression quality (jpeg/webp only)'),
    fullPage: z
      .boolean()
      .default(false)
      .describe('Capture full scrollable page'),
  }),
  output: z.object({
    action: z.literal('save_screenshot'),
    generatedFiles: GeneratedFilesSchema,
    page: z.number(),
    path: z.string(),
    format: z.enum(['png', 'jpeg', 'webp']),
    quality: z.number().optional(),
    fullPage: z.boolean(),
  }),
  handler: async (args, ctx, response) => {
    const resolvedPath = resolve(args.cwd ?? process.cwd(), args.path)
    const { data } = await ctx.browser.screenshot(args.page, {
      format: args.format,
      quality: args.quality,
      fullPage: args.fullPage,
    })
    await Bun.write(resolvedPath, Buffer.from(data, 'base64'))
    const generatedFiles: GeneratedFile[] = [
      {
        path: resolvedPath,
        mediaType: `image/${args.format}`,
        sourceTool: 'save_screenshot',
        operation: 'saved',
      },
    ]
    response.text(`Saved screenshot to ${resolvedPath}`)
    response.data({
      action: 'save_screenshot',
      page: args.page,
      generatedFiles,
      path: resolvedPath,
      format: args.format,
      quality: args.quality,
      fullPage: args.fullPage,
    })
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
  output: z.object({
    action: z.literal('download_file'),
    page: z.number(),
    element: z.number(),
    directory: z.string(),
    generatedFiles: GeneratedFilesSchema,
    suggestedFilename: z.string(),
    destinationPath: z.string(),
  }),
  handler: async (args, ctx, response) => {
    const resolvedDir = resolve(args.cwd ?? process.cwd(), args.path)
    const tempDir = await mkdtemp(join(tmpdir(), 'browseros-dl-'))

    try {
      const { filePath, suggestedFilename } =
        await ctx.browser.downloadViaClick(args.page, args.element, tempDir)

      const destPath = join(resolvedDir, suggestedFilename)
      await rename(filePath, destPath)
      const generatedFiles: GeneratedFile[] = [
        {
          path: destPath,
          sourceTool: 'download_file',
          operation: 'downloaded',
        },
      ]

      response.text(`Downloaded "${suggestedFilename}" to ${destPath}`)
      response.data({
        action: 'download_file',
        page: args.page,
        element: args.element,
        directory: resolvedDir,
        generatedFiles,
        suggestedFilename,
        destinationPath: destPath,
      })
    } finally {
      await rm(tempDir, { recursive: true, force: true }).catch(() => {})
    }
  },
})
