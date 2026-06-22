import { z } from 'zod'

/**
 * How a site-aware affordance gets its work done.
 *
 * - `mcp`    - built on top of an existing first/third-party MCP server.
 * - `api`    - calls the site's official HTTP API (REST/GraphQL).
 * - `script` - drives a live authenticated browser tab via BrowserOS primitives.
 */
export const methodSchema = z.enum(['mcp', 'api', 'script'])
export type Method = z.infer<typeof methodSchema>

/** One high-level action available via a site-MCP tool. */
export const intentSchema = z.object({
  tool: z.string(),
  args: z.string(),
  summary: z.string(),
})
export type Intent = z.infer<typeof intentSchema>

/**
 * A site's cached affordances - metadata only, no execution engine.
 */
export const recipeSchema = z.object({
  id: z.string(),
  siteMcp: z.string(),
  method: methodSchema,
  urlMatch: z.array(z.string()),
  openUrl: z.string().url(),
  intents: z.array(intentSchema),
  contextHints: z.record(z.string(), z.array(z.string())).default({}),
  flowHints: z.array(z.string()).default([]),
  notes: z.string().default(''),
})
export type Recipe = z.infer<typeof recipeSchema>

/** True if `url` matches any of `recipe.urlMatch`. */
export function matches(recipe: Recipe, url: string): boolean {
  let host = ''
  let pathname = ''
  try {
    const u = new URL(url)
    host = u.hostname
    pathname = u.pathname
  } catch {
    return false
  }
  const hostPath = host + pathname
  for (const sub of recipe.urlMatch) {
    const target = sub.startsWith('/') ? hostPath : host
    if (target.includes(sub)) {
      return true
    }
  }
  return false
}
