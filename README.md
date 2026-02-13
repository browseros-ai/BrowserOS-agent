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
│                         MCP Clients                                  │
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

Requires [process-compose](https://github.com/F1bonacc1/process-compose):

```bash
brew install process-compose
```

```bash
# Copy environment files for each package
cp apps/server/.env.example apps/server/.env.development
cp apps/agent/.env.example apps/agent/.env.development

# Start the full dev environment
process-compose up
```

The `process-compose up` command runs the following in order:
1. `bun install` — installs dependencies
2. `bun --cwd apps/controller-ext build` — builds the controller extension
3. `bun --cwd apps/agent codegen` — generates agent code
4. `bun --cwd apps/server start` and `bun --cwd apps/agent dev` — starts server and agent in parallel

### Environment Variables

Each package has its own `.env.development` file:

- `apps/server/.env.development` - Server configuration
- `apps/agent/.env.development` - Agent UI configuration

**Server Variables** (`apps/server/.env.development`)

| Variable | Default | Description |
|----------|---------|-------------|
| `BROWSEROS_SERVER_PORT` | 9100 | HTTP server port (MCP, chat, health) |
| `BROWSEROS_CDP_PORT` | 9000 | Chromium CDP port (server connects as client) |
| `BROWSEROS_EXTENSION_PORT` | 9300 | WebSocket port for controller extension |
| `BROWSEROS_CONFIG_URL` | - | Remote config endpoint for rate limits |
| `BROWSEROS_INSTALL_ID` | - | Unique installation identifier (analytics) |
| `BROWSEROS_CLIENT_ID` | - | Client identifier (analytics) |
| `POSTHOG_API_KEY` | - | Server-side PostHog API key |
| `SENTRY_DSN` | - | Server-side Sentry DSN |

**Agent Variables** (`apps/agent/.env.development`)

| Variable | Default | Description |
|----------|---------|-------------|
| `BROWSEROS_SERVER_PORT` | 9100 | Passed to BrowserOS via CLI args |
| `BROWSEROS_CDP_PORT` | 9000 | Passed to BrowserOS via CLI args |
| `BROWSEROS_EXTENSION_PORT` | 9300 | Passed to BrowserOS via CLI args |
| `VITE_BROWSEROS_SERVER_PORT` | 9100 | Agent UI connects to server (must match `BROWSEROS_SERVER_PORT`) |
| `BROWSEROS_BINARY` | - | Path to BrowserOS binary |
| `USE_BROWSEROS_BINARY` | true | Use BrowserOS instead of default Chrome |
| `VITE_PUBLIC_POSTHOG_KEY` | - | Agent UI PostHog key |
| `VITE_PUBLIC_SENTRY_DSN` | - | Agent UI Sentry DSN |

> **Note:** Port variables are duplicated in both files and must be kept in sync when running server and agent together.

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

## Contributing

We welcome contributions! Here's how to get started:

### Prerequisites

- [Bun](https://bun.sh/) v1.3.6 or later
- [process-compose](https://github.com/F1bonacc1/process-compose) (for full dev environment)

### Getting Started

```bash
# Clone the repository
git clone https://github.com/browseros-ai/BrowserOS-agent.git
cd BrowserOS-agent

# Install dependencies
bun install

# Copy environment files
cp apps/server/.env.example apps/server/.env.development
cp apps/agent/.env.example apps/agent/.env.development

# Start development environment
process-compose up
```

### Development Workflow

```bash
# Run tests
bun run test                  # Standard tests
bun run test:all              # All tests

# Linting and type checking
bun run lint                  # Check code style with Biome
bun run lint:fix              # Auto-fix linting issues
bun run typecheck             # TypeScript type checking

# Build packages
bun run build:server          # Build server
bun run build:agent           # Build agent extension
bun run build:ext             # Build controller extension
```

### Pull Requests

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Make your changes
4. Run tests and linting (`bun run test && bun run lint`)
5. Commit your changes
6. Push to your fork and open a pull request

## License

AGPL-3.0
