# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**BrowserOS** - A browser automation platform. The MCP server powers the built-in AI agent and lets external tools like `claude-code` or `gemini-cli` control the browser. Includes a React-based agent UI extension, a Go CLI, and a published TypeScript SDK.

## Coding Guidelines

- **Use extensionless imports.** Do not use `.js` extensions in TypeScript imports. Bun resolves `.ts` files automatically.
  ```typescript
  // ✅ Correct
  import { foo } from './utils'
  import type { Bar } from '../types'

  // ❌ Wrong
  import { foo } from './utils.js'
  ```
- Write minimal code comments. Only add comments for non-obvious logic, complex algorithms, or critical warnings. Skip comments for self-explanatory code, obvious function names, and simple operations.
- Logger messages should not include `[prefix]` tags (e.g., `[Config]`, `[HTTP Server]`). Source tracking automatically adds file:line:function in development mode.
- Avoid magic constants scattered in the codebase. Use `@browseros/shared` for all shared configuration:
  - `@browseros/shared/constants/ports` - Port numbers (DEFAULT_PORTS, TEST_PORTS)
  - `@browseros/shared/constants/timeouts` - Timeout values (TIMEOUTS)
  - `@browseros/shared/constants/limits` - Rate limits, pagination, content limits (RATE_LIMITS, AGENT_LIMITS, etc.)
  - `@browseros/shared/constants/urls` - External service URLs (EXTERNAL_URLS)
  - `@browseros/shared/constants/paths` - File system paths (PATHS)
  - `@browseros/shared/constants/exit-codes` - Process exit codes (EXIT_CODES)
  - `@browseros/shared/types/logger` - Logger interface types (LoggerInterface, LogLevel)
  - `@browseros/shared/schemas/llm` - LLM-related Zod schemas
  - `@browseros/shared/schemas/ui-stream` - UI streaming schemas
  - `@browseros/shared/schemas/browser-context` - Browser context schemas

## File Naming Convention

Use **kebab-case** for all file and folder names:

| Type | Convention | Example |
|------|------------|---------|
| Multi-word files | kebab-case | `ai-sdk-agent.ts`, `mcp-context.ts` |
| Single-word files | lowercase | `types.ts`, `browser.ts`, `index.ts` |
| Test files | `.test.ts` suffix | `mcp-context.test.ts` |
| Folders | kebab-case | `rate-limiter/`, `tab-groups/` |

Classes remain PascalCase in code, but live in kebab-case files:
```typescript
// file: ai-sdk-agent.ts
export class AiSdkAgent { ... }
```

## Bun Preferences

Default to using Bun instead of Node.js:

- Use `bun <file>` instead of `node <file>`
- Use `bun test` instead of `jest` or `vitest`
- Use `bun install` instead of `npm install`
- Use `bun run <script>` instead of `npm run <script>`
- Bun automatically loads .env (no dotenv needed)

## Common Commands

```bash
# Start server (development)
bun run start:server             # Starts server with --watch and .env.development
bun run start:agent              # Builds extension, starts agent dev server

# Development (watch mode)
bun run dev:watch                # Watch mode with auto-rebuild
bun run dev:watch:new            # Watch mode for new sessions
bun run dev:manual               # Manual watch mode

# Testing
bun run test                     # Run tool tests (requires BrowserOS running)
bun run test:tools               # Same as above
bun run test:integration         # Run integration tests
bun run test:sdk                 # Run SDK tests

# Run a single test file
bun --env-file=.env.development test apps/server/tests/path/to/file.test.ts

# Linting
bun run lint                     # Check with Biome
bun run lint:fix                 # Auto-fix with Biome

# Type checking
bun run typecheck                # TypeScript build check (all workspaces)

# Build
bun run build                    # Build everything (server + agent + ext)
bun run build:server             # Build server for production (all targets)
bun run build:agent              # Build agent extension (with codegen)
bun run build:agent-sdk          # Build the agent SDK package
bun run build:ext                # Build controller extension

# Code generation
bun run gen:cdp                  # Generate CDP protocol types
bun run codegen:agent            # Generate GraphQL types for agent
```

## Biome Configuration

The project uses Biome for linting and formatting:
- **Indent:** 2 spaces
- **Quotes:** Single quotes
- **Semicolons:** As needed (omitted where possible)
- **Rules:** Recommended + `noUnusedImports: error`, `noUnusedVariables: error`, `useSortedClasses: error`
- **Complexity:** `noExcessiveCognitiveComplexity` warning at threshold 30

## Architecture

This is a monorepo managed by Bun workspaces with four apps and three packages:

```
apps/
  server/          # MCP server (TypeScript/Bun)
  agent/           # Agent UI extension (React/WXT)
  controller-ext/  # Browser controller extension (Chrome APIs)
  cli/             # CLI tool (Go)
packages/
  shared/          # Shared constants, types, schemas
  agent-sdk/       # Published SDK (@browseros-ai/agent-sdk)
  cdp-protocol/    # Generated CDP protocol types
```

### Server (`apps/server`)

The main MCP server that exposes browser automation tools via HTTP/SSE.

**Entry point:** `apps/server/src/index.ts` → `apps/server/src/main.ts`

**Key directories:**

| Directory | Purpose |
|-----------|---------|
| `src/tools/` | MCP tool definitions (flat structure - see below) |
| `src/api/` | Hono HTTP server with routes, middleware, and services |
| `src/agent/` | AI agent (AI SDK integration, session management, compaction, prompts) |
| `src/browser/` | Browser abstraction layer (backends, DOM, snapshots, keyboard/mouse) |
| `src/graph/` | Graph execution engine |
| `src/lib/` | Shared utilities (clients, db, logger, rate-limiter, metrics, sentry) |

**Tools structure (`src/tools/`):**
Tools are organized as flat files and domain-specific directories:
- `navigation.ts`, `input.ts`, `dom.ts`, `snapshot.ts` - Core browser tools
- `bookmarks.ts`, `history.ts`, `windows.ts`, `tab-groups.ts` - Browser feature tools
- `page-actions.ts`, `browseros-info.ts`, `framework.ts` - Utility tools
- `filesystem/` - File system tools (bash, read, write, edit, grep, find, ls)
- `memory/` - Memory/soul tools (read, write, search, save/update core/soul)
- `tool-registry.ts`, `registry.ts` - Tool registration and discovery
- `response.ts` - Shared response formatting

**API structure (`src/api/`):**
- `routes/` - Route handlers (chat, graph, health, klavis, mcp, provider, sdk, soul, status, shutdown)
- `services/` - Business logic (chat-service, graph-service, mcp/, sdk/)
- `middleware/` - Rate limiting middleware

**Browser backends (`src/browser/backends/`):**
- `cdp.ts` - Chrome DevTools Protocol backend (direct connection)
- `controller.ts` - Browser extension backend (via WebSocket)

**Agent (`src/agent/`):**
- `ai-sdk-agent.ts` - Main agent using Vercel AI SDK
- `provider-factory.ts` - LLM provider factory (Anthropic, Google, OpenAI, Azure, Bedrock, OpenRouter)
- `tool-adapter.ts` - Adapts MCP tools for AI SDK
- `mcp-builder.ts` - Builds MCP tool definitions
- `session-store.ts` - Agent session persistence
- `compaction.ts` / `compaction-prompt.ts` - Context compaction for long sessions
- `chat-mode.ts` - Chat mode configuration
- `prompt.ts` - System prompts

### Agent Extension (`apps/agent`)

React-based browser extension built with WXT framework. Provides the agent UI.

**Stack:** React 19, WXT, Tailwind CSS 4, Radix UI, Vercel AI SDK, React Router, GraphQL

**Entry points (`entrypoints/`):**
- `sidepanel/` - Main agent sidebar UI
- `newtab/` - New tab page
- `onboarding/` - Onboarding flow
- `background/` - Service worker
- `app/` - Main app shell
- `auth.content`, `glow.content`, `content.ts` - Content scripts

**Key directories:**
- `components/` - React components (chat, sidebar, ui, auth, ai-elements)
- `hooks/` - React hooks
- `lib/` - Business logic (auth, chat-actions, graphql, llm-providers, mcp, rpc, workflows, etc.)
- `schema/` - Data schemas
- `styles/` - Global styles

Has its own `CLAUDE.md` at `apps/agent/CLAUDE.md` with agent-specific guidance.

### Controller Extension (`apps/controller-ext`)

Chrome extension that receives commands from the server via WebSocket.

**Entry point:** `src/background/index.ts` → `BrowserOSController`

**Structure:**
- `src/actions/` - Action handlers organized by domain (browser/, tab/, bookmark/, history/)
- `src/adapters/` - Chrome API adapters (TabAdapter, BookmarkAdapter, HistoryAdapter)
- `src/websocket/` - WebSocket client that connects to the server
- `src/protocol/` - Communication protocol definitions
- `src/config/` - Extension configuration

### CLI (`apps/cli`)

Go-based CLI tool for browser automation from the terminal.

**Stack:** Go, Cobra (CLI framework)

**Commands (`cmd/`):** bookmark, click, dialog, dom, eval, fill, group, health, history, info, interact, nav, open, pages, screenshot, scroll, snap, text, wait, window

```bash
# Build and run CLI
cd apps/cli && go build -o browseros . && ./browseros --help
```

### Shared (`packages/shared`)

Shared constants, types, schemas, and configuration used across the monorepo.

**Structure:**
- `src/constants/` - Configuration values (ports, timeouts, limits, urls, paths, exit-codes)
- `src/types/` - Shared type definitions (logger)
- `src/schemas/` - Zod schemas (llm, ui-stream, browser-context)

**Exports:** `@browseros/shared/constants/*`, `@browseros/shared/types/*`, `@browseros/shared/schemas/*`

### Agent SDK (`packages/agent-sdk`)

Published npm package `@browseros-ai/agent-sdk` for browser automation via natural language.

**Exports:** Single entry point via `@browseros-ai/agent-sdk`

### CDP Protocol (`packages/cdp-protocol`)

Auto-generated Chrome DevTools Protocol type definitions and APIs.

**Generated via:** `bun run gen:cdp` (runs `scripts/codegen/cdp-protocol.ts`)

**Exports:** `@browseros/cdp-protocol/domains/*`, `@browseros/cdp-protocol/domain-apis/*`

### Communication Flow

```
MCP Client / CLI ─→ HTTP Server (Hono) ─→ API Routes ─→ Tool Handler
                                                            ↓
                          CDP Backend ←── or ──→ Controller Backend
                          (direct WS)             (WS → Extension → Chrome APIs)

Agent UI Extension ─→ API Routes (chat, graph, sdk) ─→ AI SDK Agent ─→ LLM Provider
                                                           ↓
                                                      MCP Tools ─→ Browser
```

## Creating Packages

When creating new packages in this monorepo:

- **Location:** Packages go in `packages/`, apps go in `apps/`
- **No index.ts:** Don't create or export an `index.ts` - it inflates the bundle with all exports
- **Separate export files:** Keep exports in individual files (e.g., `logger.ts`, `ports.ts`)
- **Import pattern:** `import { X } from "@my-package/name/logger"` - only imports what's needed

**package.json exports:** Must include both `types` and `default` for TypeScript:
```json
"exports": {
  "./constants/ports": {
    "types": "./src/constants/ports.ts",
    "default": "./src/constants/ports.ts"
  },
  "./types/logger": {
    "types": "./src/types/logger.ts",
    "default": "./src/types/logger.ts"
  }
}
```

## Test Organization

Tests are in `apps/server/tests/`:

| Directory | Purpose | How to run |
|-----------|---------|------------|
| `tools/` | Tool tests (require BrowserOS running with CDP) | `bun run test:tools` |
| `browser/` | Browser backend tests | Single file via `bun test` |
| `agent/` | Agent tests (compaction, rate limiter) | Single file via `bun test` |
| `api/` | API route and service tests | Single file via `bun test` |
| `graph/` | Graph execution tests | Single file via `bun test` |
| `sdk/` | Agent SDK tests | `bun run test:sdk` |
| `__helpers__/` | Test utilities and fixtures | N/A |
| `__fixtures__/` | Test fixture data | N/A |

Run a single test:
```bash
bun --env-file=.env.development test apps/server/tests/path/to/file.test.ts
```

Tests use a cleanup script before running: `tests/__helpers__/cleanup.sh`
