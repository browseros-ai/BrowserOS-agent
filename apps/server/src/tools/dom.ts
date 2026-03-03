import Fuse from 'fuse.js'
import { z } from 'zod'
import type { DomElement } from '../browser/dom'
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
    "Search through DOM elements on a page using fuzzy text matching. Like grep for web pages — finds elements by text content, attributes, IDs, or class names. Returns matching elements with their tag, text, attributes, and CSS path. Supports extended search syntax: 'exact for exact match, ^prefix for starts-with, suffix$ for ends-with, !term to exclude.",
  input: z.object({
    page: pageParam,
    query: z
      .string()
      .describe('Search query (supports fuzzy and extended search syntax)'),
    selector: z
      .string()
      .optional()
      .describe("CSS selector to scope the search (e.g. 'main', 'form')"),
    limit: z
      .number()
      .default(25)
      .describe('Maximum number of results to return'),
  }),
  handler: async (args, ctx, response) => {
    const elements = await ctx.browser.collectDomElements(args.page, {
      selector: args.selector,
    })

    if (elements.length === 0) {
      response.text('No searchable elements found on the page.')
      return
    }

    const flatElements = elements.map((el) => ({
      ...el,
      attrValues: el.attributes ? Object.values(el.attributes).join(' ') : '',
    }))

    const fuse = new Fuse(flatElements, {
      keys: [
        { name: 'text', weight: 0.4 },
        { name: 'id', weight: 0.2 },
        { name: 'className', weight: 0.15 },
        { name: 'attrValues', weight: 0.15 },
        { name: 'tag', weight: 0.1 },
      ],
      threshold: 0.4,
      includeScore: true,
      useExtendedSearch: true,
    })

    const results = fuse.search(args.query, { limit: args.limit })

    if (results.length === 0) {
      response.text(`No elements matching "${args.query}" found.`)
      return
    }

    const lines = results.map((r) => formatElement(r.item, r.score))
    response.text(
      `Found ${results.length} matching elements (searched ${elements.length} total):\n\n${lines.join('\n\n')}`,
    )
  },
})

function esc(s: string): string {
  return s.replace(/"/g, '\\"')
}

function formatElement(
  el: DomElement & { attrValues: string },
  score?: number,
): string {
  const parts: string[] = []

  let header = `<${el.tag}`
  if (el.id) header += ` id="${esc(el.id)}"`
  if (el.className) header += ` class="${esc(el.className)}"`
  header += '>'
  parts.push(header)

  if (el.text) parts.push(`  text: "${esc(el.text)}"`)
  if (el.attributes) {
    for (const [k, v] of Object.entries(el.attributes)) {
      parts.push(`  ${k}: "${esc(v)}"`)
    }
  }
  parts.push(`  path: ${el.path}`)
  if (score !== undefined) parts.push(`  score: ${(1 - score).toFixed(2)}`)

  return parts.join('\n')
}
