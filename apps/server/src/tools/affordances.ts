import { z } from 'zod'
import { createDefaultRegistry } from '../affordances/recipes'
import { contextIntentsFor, type RecipeRegistry } from '../affordances/registry'
import { defineTool } from './framework'

/**
 * Site-affordance tools.
 *
 * These sit one level above the BrowserOS primitives (snapshot/click/navigate)
 * and give the agent a discovery surface for site-specific cached recipes.
 * Instead of "snapshot → find compose button → click → wait → snapshot → find
 * To field → fill → ...", the agent calls `site_describe(page)`, sees that
 * Gmail's compose URL parameters skip the click chain entirely, and uses
 * `navigate_page` with the right URL.
 *
 * Recipes themselves are pure metadata — see `affordances/types.ts` and
 * `affordances/recipes.ts`. To add your own, register on the shared registry.
 */

// Module-level singleton so all three tools share the same registry. Users
// can call `registry.register(...)` at startup to add their own recipes.
export const registry: RecipeRegistry = createDefaultRegistry()

const recipeJson = (r: ReturnType<RecipeRegistry['findById']>) => {
  if (!r) return null
  return {
    id: r.id,
    site_mcp: r.siteMcp,
    method: r.method, // mcp | api | script
    url_match: r.urlMatch,
    open_url: r.openUrl,
    intents: r.intents,
    flow_hints: r.flowHints,
    notes: r.notes,
  }
}

export const site_describe = defineTool({
  name: 'site_describe',
  description:
    'Given a page, return cached affordance metadata for the matching site — ' +
    'recommended high-level tools, URL-aware contextual hints, and how the ' +
    "site's MCP is implemented (mcp/api/script). Use BEFORE take_snapshot " +
    'to discover whether a cached recipe path exists. Always succeeds; for ' +
    'unknown sites returns `{recognized: false}` and a fallback hint.',
  input: z.object({
    page: z.number().describe('Page ID (from list_pages)'),
  }),
  output: z.object({
    recognized: z.boolean(),
    url: z.string(),
    title: z.string().optional(),
    site: z.string().optional(),
    site_mcp: z.string().optional(),
    method: z.enum(['mcp', 'api', 'script']).optional(),
    intents: z
      .array(
        z.object({ tool: z.string(), args: z.string(), summary: z.string() }),
      )
      .optional(),
    contextual_intents: z.array(z.string()).optional(),
    flow_hints: z.array(z.string()).optional(),
    notes: z.string().optional(),
    next_actions: z.array(z.string()),
  }),
  handler: async (args, ctx, response) => {
    const pages = await ctx.browser.listPages()
    const page = pages.find((p) => p.pageId === args.page)
    if (!page) {
      response.error(`No page with id ${args.page}. Call list_pages first.`)
      return
    }

    const recipe = registry.findByUrl(page.url)
    if (!recipe) {
      const out = {
        recognized: false as const,
        url: page.url,
        title: page.title,
        next_actions: [
          'take_snapshot(page) — no cached recipe; use raw DOM',
          'site_intents() — see what sites have cached recipes',
        ],
      }
      response.text(JSON.stringify(out, null, 2))
      response.data(out)
      return
    }

    const contextual = contextIntentsFor(recipe, page.url)
    const out = {
      recognized: true as const,
      url: page.url,
      title: page.title,
      site: recipe.id,
      site_mcp: recipe.siteMcp,
      method: recipe.method,
      intents: recipe.intents,
      contextual_intents: contextual,
      flow_hints: recipe.flowHints,
      notes: recipe.notes,
      next_actions: [
        `Prefer ${recipe.siteMcp}_* tools over take_snapshot+click here.`,
        ...contextual.map((t) => `On this URL, try: ${t}`),
        ...recipe.flowHints.map((h) => `Common flow: ${h}`),
        'take_snapshot(page) — fallback if no intent fits',
      ],
    }
    response.text(JSON.stringify(out, null, 2))
    response.data(out)
  },
})

export const site_intents = defineTool({
  name: 'site_intents',
  description:
    'Return the full registry of recognised sites and their cached intents. ' +
    'Use when planning a multi-site task or when you do not know what sites ' +
    'have cached recipes available.',
  input: z.object({}),
  output: z.object({
    sites: z.array(z.unknown()),
    count: z.number(),
    next_actions: z.array(z.string()),
  }),
  handler: async (_args, _ctx, response) => {
    const sites = registry.all().map(recipeJson)
    const out = {
      sites,
      count: sites.length,
      next_actions: [
        "site_open(site_id='wikipedia') — navigate to a known site",
        'site_describe(page) — once on a site, get contextual hints',
      ],
    }
    response.text(JSON.stringify(out, null, 2))
    response.data(out)
  },
})

export const site_open = defineTool({
  name: 'site_open',
  description:
    "Open a known site by id (e.g. 'wikipedia', 'pubmed'). If `page` is " +
    'given, navigates that tab; otherwise opens a new tab. Returns the page ' +
    "id and the recipe's intents so the agent can immediately call a " +
    'high-level tool.',
  input: z.object({
    site_id: z.string().describe('Recipe id, e.g. "wikipedia"'),
    page: z
      .number()
      .optional()
      .describe('If given, reuse this tab instead of opening a new one'),
  }),
  output: z.object({
    ok: z.boolean(),
    site: z.string().optional(),
    site_mcp: z.string().optional(),
    method: z.enum(['mcp', 'api', 'script']).optional(),
    page_id: z.number().optional(),
    url: z.string().optional(),
    intents: z
      .array(
        z.object({ tool: z.string(), args: z.string(), summary: z.string() }),
      )
      .optional(),
    next_actions: z.array(z.string()),
    error: z.string().optional(),
  }),
  handler: async (args, ctx, response) => {
    const recipe = registry.findById(args.site_id)
    if (!recipe) {
      const out = {
        ok: false as const,
        error: `unknown site_id '${args.site_id}'`,
        next_actions: ['site_intents() — list available site ids'],
      }
      response.text(JSON.stringify(out, null, 2))
      response.data(out)
      return
    }

    let pageId: number
    if (args.page !== undefined) {
      await ctx.browser.goto(args.page, recipe.openUrl)
      pageId = args.page
    } else {
      pageId = await ctx.browser.newPage(recipe.openUrl, {})
    }

    const out = {
      ok: true as const,
      site: recipe.id,
      site_mcp: recipe.siteMcp,
      method: recipe.method,
      page_id: pageId,
      url: recipe.openUrl,
      intents: recipe.intents,
      next_actions: [
        `site_describe(page=${pageId}) — verify and get contextual intents`,
        ...recipe.intents
          .slice(0, 3)
          .map((i) => `${i.tool}${i.args} — ${i.summary}`),
      ],
    }
    response.text(JSON.stringify(out, null, 2))
    response.data(out)
  },
})
