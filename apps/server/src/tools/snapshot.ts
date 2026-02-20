import { z } from 'zod'
import { defineTool } from './core/framework'

const pageParam = z.number().describe('Page ID (from list_pages)')

export const take_snapshot = defineTool({
  name: 'take_snapshot',
  description:
    'Get a concise snapshot of interactive elements on the page. Returns a flat list with element IDs (e.g. [47]) that can be used with click, fill, hover, etc. Always take a snapshot before interacting with page elements.',
  input: z.object({
    page: pageParam,
  }),
  handler: async (args, ctx, response) => {
    const tree = await ctx.browser.snapshot(args.page)
    response.text(tree || 'Page has no interactive elements.')
  },
})

export const take_enhanced_snapshot = defineTool({
  name: 'take_enhanced_snapshot',
  description:
    'Get a detailed accessibility tree of the page with structural context (headings, landmarks, dialogs) and cursor-interactive elements that ARIA misses. Use when you need more context than take_snapshot provides.',
  input: z.object({
    page: pageParam,
  }),
  handler: async (args, ctx, response) => {
    const tree = await ctx.browser.enhancedSnapshot(args.page)
    response.text(tree || 'Page has no visible content.')
  },
})

export const get_page_content = defineTool({
  name: 'get_page_content',
  description:
    'Extract the visible text content of the page. Use for reading articles, understanding page content, or extracting data. Not for automation — use take_snapshot for that.',
  input: z.object({
    page: pageParam,
    selector: z
      .string()
      .optional()
      .describe(
        "CSS selector to scope extraction (e.g. 'main', '.article-body')",
      ),
  }),
  handler: async (args, ctx, response) => {
    const text = await ctx.browser.content(args.page, args.selector)
    response.text(text || 'No text content found.')
  },
})

export const take_screenshot = defineTool({
  name: 'take_screenshot',
  description: 'Take a screenshot of a page',
  input: z.object({
    page: pageParam,
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
  handler: async (args, ctx, response) => {
    const { data, mimeType } = await ctx.browser.screenshot(args.page, {
      format: args.format,
      quality: args.quality,
      fullPage: args.fullPage,
    })
    response.image(data, mimeType)
  },
})

export const evaluate_script = defineTool({
  name: 'evaluate_script',
  description:
    'Execute JavaScript in the page context. Returns the result as a string. Use for reading page state or performing actions not covered by other tools.',
  input: z.object({
    page: pageParam,
    expression: z.string().describe('JavaScript expression to evaluate'),
  }),
  handler: async (args, ctx, response) => {
    const result = await ctx.browser.evaluate(args.page, args.expression)

    if (result.error) {
      response.error(`Script error: ${result.error}`)
      return
    }

    const val = result.value
    if (val === undefined) {
      response.text(result.description ?? 'undefined')
    } else if (typeof val === 'string') {
      response.text(val)
    } else {
      response.text(JSON.stringify(val, null, 2))
    }
  },
})
