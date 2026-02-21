import { z } from 'zod'
import { defineTool } from './framework'

const pageParam = z.number().describe('Page ID (from list_pages)')

export const get_active_page = defineTool({
  name: 'get_active_page',
  description: 'Get the currently active (focused) page in the browser',
  input: z.object({}),
  handler: async (_args, ctx, response) => {
    const page = await ctx.browser.getActivePage()
    if (!page) {
      response.error('No active page found.')
      return
    }
    response.text(`Active page: ${page.pageId}\n${page.title}\n${page.url}`)
  },
})

export const list_pages = defineTool({
  name: 'list_pages',
  description: 'List all pages (tabs) currently open in the browser',
  input: z.object({}),
  handler: async (_args, ctx, response) => {
    const pages = await ctx.browser.listPages()

    if (pages.length === 0) {
      response.text('No pages open.')
      return
    }

    const lines = pages.map((p) => `${p.pageId}. ${p.title}\n   ${p.url}`)
    response.text(lines.join('\n\n'))
  },
})

export const navigate_page = defineTool({
  name: 'navigate_page',
  description: 'Navigate a page to a URL, or go back/forward/reload',
  input: z.object({
    page: pageParam,
    action: z
      .enum(['url', 'back', 'forward', 'reload'])
      .default('url')
      .describe('Navigation action'),
    url: z
      .string()
      .optional()
      .describe("URL to navigate to (required when action is 'url')"),
  }),
  handler: async (args, ctx, response) => {
    if (args.action === 'url' && !args.url) {
      response.error(
        'URL is required when action is "url". Provide a url parameter.',
      )
      return
    }

    switch (args.action) {
      case 'url':
        await ctx.browser.goto(args.page, args.url as string)
        break
      case 'back':
        await ctx.browser.goBack(args.page)
        break
      case 'forward':
        await ctx.browser.goForward(args.page)
        break
      case 'reload':
        await ctx.browser.reload(args.page)
        break
    }

    const messages: Record<string, string> = {
      url: `Navigated to ${args.url}`,
      back: 'Navigated back',
      forward: 'Navigated forward',
      reload: 'Page reloaded',
    }
    response.text(messages[args.action] ?? 'Done')
    response.includeSnapshot(0)
  },
})

export const new_page = defineTool({
  name: 'new_page',
  description: 'Open a new page (tab) and navigate to a URL',
  input: z.object({
    url: z.string().describe('URL to open'),
  }),
  handler: async (args, ctx, response) => {
    const pageId = await ctx.browser.newPage(args.url)
    response.text(`Opened new page: ${args.url}\nPage ID: ${pageId}`)
  },
})

export const close_page = defineTool({
  name: 'close_page',
  description: 'Close a page (tab)',
  input: z.object({
    page: pageParam,
  }),
  handler: async (args, ctx, response) => {
    await ctx.browser.closePage(args.page)
    response.text(`Closed page ${args.page}`)
  },
})

export const wait_for = defineTool({
  name: 'wait_for',
  description:
    'Wait for text or a CSS selector to appear on the page. Polls periodically up to a timeout.',
  input: z.object({
    page: pageParam,
    text: z.string().optional().describe('Text to wait for on the page'),
    selector: z.string().optional().describe('CSS selector to wait for'),
    timeout: z
      .number()
      .default(10000)
      .describe('Maximum wait time in milliseconds'),
  }),
  handler: async (args, ctx, response) => {
    if (!args.text && !args.selector) {
      response.error('Provide either text or selector to wait for.')
      return
    }

    const found = await ctx.browser.waitFor(args.page, {
      text: args.text,
      selector: args.selector,
      timeout: args.timeout,
    })

    if (found) {
      const target = args.text
        ? `text "${args.text}"`
        : `selector "${args.selector}"`
      response.text(`Found ${target} on page.`)
      response.includeSnapshot(0)
    } else {
      const target = args.text
        ? `text "${args.text}"`
        : `selector "${args.selector}"`
      response.error(`Timed out after ${args.timeout}ms waiting for ${target}.`)
    }
  },
})
