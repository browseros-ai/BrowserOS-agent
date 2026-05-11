# Site affordances

> A discovery surface for site-aware cached recipes on top of BrowserOS's
> primitives. Tell the agent "you're on Gmail — call `gmail_compose`, not
> `take_snapshot`+`click`+`fill`" so it lands on the cached path instead of
> re-deriving the click sequence every time.

## Why this exists

The base BrowserOS tool surface (`take_snapshot`, `click`, `fill`,
`navigate_page`, `evaluate_script`, …) is low-level. An agent using only
those has to (1) discover what's possible on each site, and (2) re-derive
the click sequence every time. Both are slow and flaky.

A *recipe* is metadata that tells the agent, in one tool call:

- "this URL is Gmail";
- "the high-level intents you can call here are `gmail_compose`,
  `gmail_list_recent`, …";
- "based on the URL fragment you're currently on (e.g. `#search/`), the
  most relevant ones are X and Y";
- "this site-MCP is implemented via `script` (DOM/JS), so expect it to be
  brittle if Gmail's DOM rotates".

Recipes are **pure metadata** — they don't execute anything. The actual
deterministic work happens in whatever site-MCP / API / script each recipe
points at via its `intents`.

## The three tools

| Tool             | What it does                                                                                                                          |
|------------------|----------------------------------------------------------------------------------------------------------------------------------------|
| `site_describe`  | Given a page id, returns the matching recipe (intents, method, URL-aware contextual hints, flow hints). Falls back gracefully if no recipe matches. |
| `site_intents`   | Returns the full registry of recognised sites — useful for planning multi-site tasks.                                                  |
| `site_open`      | Open a known site by id (e.g. `wikipedia`). Returns the new page id and intents so the agent can act immediately.                     |

## The `method` classification

Each recipe declares **how it's implemented**:

- `mcp` — built on top of an existing first/third-party MCP server. Cheapest,
  most reliable. Almost always preferred when available.
- `api` — calls the site's official HTTP API. Reliable, but needs an API key
  or OAuth.
- `script` — drives a live authenticated browser tab via BrowserOS
  primitives. No API needed; works on any site you can log into; brittle
  if the DOM changes.

The classification surfaces in `site_describe` / `site_intents` / `site_open`
output so the agent (and human reviewer) sees the cost / auth / reliability
profile at a glance.

## Adding your own recipe

```ts
import { registry } from './apps/server/src/tools/affordances'
import type { Recipe } from './apps/server/src/affordances/types'

const myRecipe: Recipe = {
  id: 'github',
  siteMcp: 'github',
  method: 'api', // gh CLI / REST API > DOM scraping
  urlMatch: ['github.com'],
  openUrl: 'https://github.com/',
  intents: [
    { tool: 'gh_search_issues', args: '(query, count=20)', summary: 'Search issues' },
    { tool: 'gh_open_pr', args: '(repo, number)', summary: 'Open a PR by number' },
  ],
  contextHints: {
    '/issues': ['gh_search_issues'],
    '/pull/': ['gh_open_pr'],
  },
  flowHints: ['list issues → open by number → comment'],
  notes: '',
}

registry.register(myRecipe)
```

## Built-in starter recipes

The default registry ships with two universal examples (no site-specific auth,
broad relevance):

- `wikipedia` — search + article extraction via `get_page_content`
- `pubmed`    — search + abstract extraction; NCBI's E-utilities API
                exists if you prefer `method: 'api'`

These point at existing BrowserOS primitives so they work out of the box.
For a larger reference implementation covering 15 sites (Gmail, Outlook,
Canvas, Claude.ai, Notion, LinkedIn, YouTube, …), see
[r-sayar/cloud-browser-mcp](https://github.com/r-sayar/cloud-browser-mcp) —
each site has its own Python stdio MCP server backed by a logged-in
BrowserOS tab.

## Design

Recipes are deliberately **just data**, not a DSL. The matcher
(`affordances/types.ts → matches()`) parses the URL once, then does cheap
substring tests against `urlMatch`. Path-style entries (`/in/`) match
host+path; everything else matches host only — avoids false positives on
auth/redirect flows whose query strings mention a third-party site.

The registry is in-process and shared by all three tools (see the
`registry` singleton in `apps/server/src/tools/affordances.ts`). Mutating
it at startup is the intended extension point.

## Non-goals

- **Not an execution engine.** Recipes don't run JavaScript or open tabs
  themselves — that's `navigate_page` / `evaluate_script` / your site-MCP.
- **Not a router.** The agent still picks which tool to call; recipes just
  tell it which tools are *available* for the current site.
- **Not auth-aware.** Recipes don't know if you're signed in — they assume
  the calling agent has handled login.
