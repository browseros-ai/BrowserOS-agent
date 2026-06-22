import { z } from 'zod'

/**
 * How a site-aware affordance gets its work done.
 *
 * - `mcp`    — built on top of an existing first/third-party MCP server.
 *              Cheapest, most reliable. Almost always preferred when available.
 * - `api`    — calls the site's official HTTP API (REST/GraphQL). Reliable,
 *              but requires an API key or OAuth flow.
 * - `script` — drives a live authenticated browser tab via BrowserOS primitives
 *              (take_snapshot, click, navigate_page, evaluate_script). No API
 *              needed; works on any site you can sign into; brittle if the
 *              DOM changes.
 *
 * Each recipe declares one method so the agent (and reviewer) sees the
 * cost / reliability / auth profile at a glance.
 */
export const methodSchema = z.enum(['mcp', 'api', 'script'])
export type Method = z.infer<typeof methodSchema>

/** One high-level action available via a site-MCP tool. */
export const intentSchema = z.object({
  /** Tool name as the agent will call it, e.g. `gmail_compose`. */
  tool: z.string(),
  /** Argument signature, e.g. `(to, subject, body, send=False)`. */
  args: z.string(),
  /** One-line description of what the tool does. */
  summary: z.string(),
})
export type Intent = z.infer<typeof intentSchema>

/**
 * A site's cached affordances — metadata only, no execution engine.
 *
 * Tells the agent: "you're on $site — call $tool instead of re-deriving the
 * click sequence." The actual deterministic recipes live in their own
 * site-MCP servers; this entry just points the agent at the right tool.
 */
export const recipeSchema = z.object({
  /** Short identifier, e.g. `gmail`. */
  id: z.string(),
  /** Display name of the site-MCP server hosting the intents (e.g. `gmail`). */
  siteMcp: z.string(),
  /** How this affordance is implemented under the hood. */
  method: methodSchema,
  /**
   * Host (or host+path) substrings that mean "we're on this site".
   * Entries starting with `/` match against host+path; everything else
   * matches against the hostname only (avoids false positives on auth/
   * redirect flows whose query strings mention a third-party site).
   */
  urlMatch: z.array(z.string()),
  /** Canonical landing URL (used by site_open). */
  openUrl: z.string().url(),
  /** All high-level intents this site exposes. */
  intents: z.array(intentSchema),
  /**
   * URL substring → list of tool names that are *especially* relevant on
   * that URL. e.g. `{ "/messages": ["linkedin_list_messages"] }`.
   */
  contextHints: z.record(z.string(), z.array(z.string())).default({}),
  /** Always-shown follow-on chain advice. */
  flowHints: z.array(z.string()).default([]),
  /** Free-form notes (e.g. login playbook references). */
  notes: z.string().default(''),
})
export type Recipe = z.infer<typeof recipeSchema>

/**
 * True if `url`'s hostname (or, for path-prefixed entries, its host+path)
 * contains any of `recipe.urlMatch`.
 */
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
