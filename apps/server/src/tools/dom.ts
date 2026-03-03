import { z } from 'zod'
import { formatSearchResult } from '../browser/dom'
import { defineTool } from './framework'

const MAX_DOM_HTML_LENGTH = 100_000

const pageParam = z.number().describe('Page ID (from list_pages)')

export const get_dom = defineTool({
  name: 'get_dom',
  description:
    'Get the raw HTML DOM structure of a page or a specific element. Returns outer HTML. Use a CSS selector to scope to a specific part of the page and avoid large responses. For readable text content, prefer get_page_content instead.',
  input: z.object({
    page: pageParam,
    selector: z
      .string()
      .optional()
      .describe(
        "CSS selector to scope (e.g. 'main', '#content', 'form.login')",
      ),
  }),
  handler: async (args, ctx, response) => {
    const html = await ctx.browser.getDom(args.page, {
      selector: args.selector,
    })

    if (!html) {
      response.error(
        args.selector
          ? `No element found matching "${args.selector}".`
          : 'Page has no DOM content.',
      )
      return
    }

    if (html.length > MAX_DOM_HTML_LENGTH) {
      response.text(
        `${html.substring(0, MAX_DOM_HTML_LENGTH)}\n\n[Truncated — ${html.length} chars total. Use a CSS selector to scope to a specific element.]`,
      )
      return
    }

    response.text(html)
  },
})

export const search_dom = defineTool({
  name: 'search_dom',
  description:
    'Search the DOM using plain text, CSS selectors, or XPath queries. Uses the browser\'s native DOM search. Returns matching elements with tag name and attributes. Examples: "Login" (text search), "input[type=email]" (CSS), "//button[@aria-label]" (XPath).',
  input: z.object({
    page: pageParam,
    query: z
      .string()
      .describe('Search query — plain text, CSS selector, or XPath expression'),
    limit: z
      .number()
      .int()
      .min(1)
      .max(200)
      .default(25)
      .describe('Maximum number of results to return (1–200)'),
  }),
  handler: async (args, ctx, response) => {
    const { results, totalCount } = await ctx.browser.searchDom(
      args.page,
      args.query,
      { limit: args.limit },
    )

    if (results.length === 0) {
      response.text(`No elements matching "${args.query}" found.`)
      return
    }

    const lines = results.map(formatSearchResult)
    const suffix =
      totalCount > results.length
        ? `\n\n[Showing ${results.length} of ${totalCount} matches. Increase limit to see more.]`
        : ''
    response.text(
      `Found ${totalCount} matching elements:\n\n${lines.join('\n\n')}${suffix}`,
    )
  },
})
