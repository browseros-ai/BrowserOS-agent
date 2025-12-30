# BrowserOS Agent

Monorepo for the BrowserOS-agent -- contains 3 packages: agent-UI, server (which contains the agent loop) and controller-extension (which is used by the tools within the agent loop).

> **⚠️ NOTE:** This is only a submodule, the main project is at -- https://github.com/browseros-ai/BrowserOS

## Monorepo Structure

```
apps/
  server/          # Bun server - MCP endpoints + agent loop
  agent/           # Agent UI (Chrome extension)
  controller-ext/  # BrowserOS Controller (Chrome extension for chrome.* APIs)

packages/
  shared/          # Shared constants (ports, timeouts, limits)
```

| Package | Description |
|---------|-------------|
| `apps/server` | Bun server exposing MCP tools and running the agent loop |
| `apps/agent` | Agent UI - Chrome extension for the chat interface |
| `apps/controller-ext` | BrowserOS Controller - Chrome extension that bridges `chrome.*` APIs (tabs, bookmarks, history) to the server via WebSocket |
| `packages/shared` | Shared constants used across packages |

## Architecture

- `apps/server`: Bun server which contains the agent loop and tools.
- `apps/agent`: Agent UI (Chrome extension).
- `apps/controller-ext`: BrowserOS Controller - a Chrome extension that bridges `chrome.*` APIs to the server. Controller tools within the server communicate with this extension via WebSocket.

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         External Clients                                  │
│                (Agent UI, claude-code via MCP)                           │
└──────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ HTTP/SSE
                                    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                 BrowserOS Server (serverPort: 9100)                      │
│                                                                          │
│   /mcp ─────── MCP tool endpoints                                        │
│   /chat ────── Agent streaming                                           │
│   /health ─── Health check                                               │
│                                                                          │
│   Tools:                                                                 │
│   ├── CDP Tools (console, network, input, screenshot, ...)              │
│   └── Controller Tools (tabs, navigation, clicks, bookmarks, history)   │
└──────────────────────────────────────────────────────────────────────────┘
          │                                         │
          │ CDP (client)                            │ WebSocket (server)
          ▼                                         ▼
┌─────────────────────┐              ┌─────────────────────────────────────┐
│   Chromium CDP      │              │   BrowserOS Controller Extension    │
│  (cdpPort: 9000)    │              │     (extensionPort: 9300)           │
│                     │              │                                     │
│ Server connects     │              │ Bridges chrome.tabs, chrome.history │
│ TO this as client   │              │ chrome.bookmarks to the server      │
└─────────────────────┘              └─────────────────────────────────────┘
```

### Ports

| Port | Env Variable | Purpose |
|------|--------------|---------|
| 9100 | `BROWSEROS_SERVER_PORT` | HTTP server - MCP endpoints, agent chat, health |
| 9000 | `BROWSEROS_CDP_PORT` | Chromium CDP server (BrowserOS Server connects as client) |
| 9300 | `BROWSEROS_EXTENSION_PORT` | WebSocket server for controller extension |

## Development

### Setup

```bash
# Install dependencies
bun install

# Copy environment file
cp .env.example .env.development
```

### Environment Variables

Single `.env.development` at root. Key variables:

**Ports**

| Variable | Default | Description |
|----------|---------|-------------|
| `BROWSEROS_SERVER_PORT` | 9100 | Server HTTP port (MCP, chat, health) |
| `BROWSEROS_CDP_PORT` | 9000 | Chromium CDP port (server connects as client) |
| `BROWSEROS_EXTENSION_PORT` | 9300 | WebSocket port for controller extension |
| `VITE_BROWSEROS_SERVER_PORT` | 9100 | Agent UI uses this to connect to server (must match `BROWSEROS_SERVER_PORT`) |

**BrowserOS Config**

| Variable | Description |
|----------|-------------|
| `BROWSEROS_CONFIG_URL` | Remote config endpoint for rate limits and LLM provider config |
| `BROWSEROS_INSTALL_ID` | Unique installation identifier (for analytics) |
| `BROWSEROS_CLIENT_ID` | Client identifier (for analytics) |

**Telemetry**

Server (Bun process) and Agent UI (Chrome extension) run in different environments, so they require separate telemetry configuration. Server uses `posthog-node`, Agent UI uses `posthog-js`. The `VITE_` prefix exposes variables to the browser bundle.

| Variable | Description |
|----------|-------------|
| `POSTHOG_API_KEY` | Server-side PostHog API key |
| `POSTHOG_ENDPOINT` | Server-side PostHog endpoint |
| `SENTRY_DSN` | Server-side Sentry DSN |
| `VITE_PUBLIC_POSTHOG_KEY` | Agent UI PostHog key |
| `VITE_PUBLIC_POSTHOG_HOST` | Agent UI PostHog host |
| `VITE_PUBLIC_SENTRY_DSN` | Agent UI Sentry DSN |

### Commands

```bash
# Start
bun run start:server          # Start the server
bun run start:agent           # Start agent extension (dev mode)

# Build
bun run build:server          # Build server for production
bun run build:agent           # Build agent extension
bun run build:ext             # Build controller extension

# Test
bun run test                  # Run standard tests
bun run test:cdp              # Run CDP-based tests
bun run test:controller       # Run controller-based tests
bun run test:integration      # Run integration tests

# Quality
bun run lint                  # Check with Biome
bun run lint:fix              # Auto-fix
bun run typecheck             # TypeScript check
```

## License

AGPL-3.0
