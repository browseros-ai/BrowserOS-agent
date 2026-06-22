import { RecipeRegistry } from './registry'
import type { Recipe } from './types'

/**
 * Built-in starter recipes — universal sites with broad relevance and no
 * site-specific auth. These point at BrowserOS's existing primitives
 * (take_snapshot, get_page_content, navigate_page) rather than separate
 * site-MCP servers, so they work out of the box.
 *
 * To add your own: register a Recipe that points at your custom MCP server's
 * tools. See `docs/affordances.md` for the full recipe-authoring guide.
 *
 * A larger reference implementation that covers 15 sites (Gmail, Outlook,
 * Canvas, Claude.ai, Notion, LinkedIn, YouTube, Wikipedia, PubMed, etc.)
 * lives at https://github.com/r-sayar/cloud-browser-mcp — those use the
 * "script" method against logged-in BrowserOS tabs.
 */
export const builtInRecipes: Recipe[] = [
  {
    id: 'wikipedia',
    siteMcp: 'browseros',
    method: 'script',
    urlMatch: ['wikipedia.org'],
    openUrl: 'https://en.wikipedia.org/',
    intents: [
      {
        tool: 'get_page_content',
        args: '(page, selector="#mw-content-text")',
        summary: 'Extract the article body as clean markdown',
      },
      {
        tool: 'navigate_page',
        args: '(page, url="https://en.wikipedia.org/wiki/Special:Search?search=<q>")',
        summary: 'Run a search via URL',
      },
    ],
    contextHints: {
      '/wiki/': [
        'get_page_content — pull the article markdown without DOM scraping',
      ],
      'Special:Search': ['get_page_content — read the result list'],
    },
    flowHints: [
      'For long articles, get_page_content with selector="#mw-content-text" is much smaller than take_snapshot',
    ],
    notes: '',
  },
  {
    id: 'pubmed',
    siteMcp: 'browseros',
    method: 'script',
    urlMatch: ['pubmed.ncbi.nlm.nih.gov'],
    openUrl: 'https://pubmed.ncbi.nlm.nih.gov/',
    intents: [
      {
        tool: 'navigate_page',
        args: '(page, url="https://pubmed.ncbi.nlm.nih.gov/?term=<q>")',
        summary: 'Search PubMed (MeSH, [tw], date filters supported)',
      },
      {
        tool: 'get_page_content',
        args: '(page, selector="article")',
        summary: 'Extract title + abstract on a PMID page',
      },
    ],
    contextHints: {
      '/?term=': ['get_page_content — read the result list'],
    },
    flowHints: ['search → click a result → get_page_content for the abstract'],
    notes:
      'NCBI also exposes the E-utilities API if you prefer method:"api" — see https://www.ncbi.nlm.nih.gov/books/NBK25500/',
  },
]

/** Default registry populated with the built-in starter recipes. */
export function createDefaultRegistry(): RecipeRegistry {
  return new RecipeRegistry().registerMany(builtInRecipes)
}
