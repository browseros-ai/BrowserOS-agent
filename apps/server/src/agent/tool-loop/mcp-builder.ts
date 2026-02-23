import { createMCPClient } from '@ai-sdk/mcp'
import type { BrowserContext } from '@browseros/shared/schemas/browser-context'
import type { ToolSet } from 'ai'
import type { KlavisClient } from '../../lib/clients/klavis/klavis-client'
import { logger } from '../../lib/logger'
import {
  detectMcpTransport,
  type McpTransportType,
} from '../../lib/mcp-transport-detect'

export interface McpServerSpec {
  name: string
  url: string
  transport: McpTransportType
  headers?: Record<string, string>
}

export interface McpServerSpecDeps {
  mcpServerUrl: string
  browserContext?: BrowserContext
  klavisClient?: KlavisClient
  browserosId?: string
}

export interface McpClientBundle {
  clients: Array<{ close(): Promise<void> }>
  tools: ToolSet
}

// Build list of MCP server specs from config + browser context
export async function buildMcpServerSpecs(
  deps: McpServerSpecDeps,
): Promise<McpServerSpec[]> {
  const specs: McpServerSpec[] = []

  // BrowserOS self-hosted MCP server
  if (deps.mcpServerUrl) {
    specs.push({
      name: 'browseros-mcp',
      url: deps.mcpServerUrl,
      transport: 'streamable-http',
      headers: {
        Accept: 'application/json, text/event-stream',
        'X-BrowserOS-Source': 'agent-runtime',
        ...(deps.browserContext?.windowId != null && {
          'X-BrowserOS-Window-Id': String(deps.browserContext.windowId),
        }),
      },
    })
  }

  // Klavis Strata MCP servers
  if (
    deps.browserosId &&
    deps.klavisClient &&
    deps.browserContext?.enabledMcpServers?.length
  ) {
    try {
      const result = await deps.klavisClient.createStrata(
        deps.browserosId,
        deps.browserContext.enabledMcpServers,
      )
      specs.push({
        name: 'klavis-strata',
        url: result.strataServerUrl,
        transport: 'streamable-http',
      })
      logger.info('Added Klavis Strata MCP server', {
        browserosId: deps.browserosId.slice(0, 12),
        servers: deps.browserContext.enabledMcpServers,
      })
    } catch (error) {
      logger.error('Failed to create Klavis Strata MCP server', {
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  // User-provided custom MCP servers
  if (deps.browserContext?.customMcpServers?.length) {
    const servers = deps.browserContext.customMcpServers
    const transports = await Promise.all(
      servers.map((s) => detectMcpTransport(s.url)),
    )
    for (let i = 0; i < servers.length; i++) {
      specs.push({
        name: `custom-${servers[i].name}`,
        url: servers[i].url,
        transport: transports[i],
      })
    }
  }

  return specs
}

// Create MCP clients from specs, return merged toolset
export async function createMcpClients(
  specs: McpServerSpec[],
): Promise<McpClientBundle> {
  const clients: Array<{ close(): Promise<void> }> = []
  let tools: ToolSet = {}

  for (const spec of specs) {
    const client = await createMCPClient({
      transport: {
        type: spec.transport === 'sse' ? 'sse' : 'http',
        url: spec.url,
        headers: spec.headers,
      },
    })
    clients.push(client)
    const clientTools = await client.tools()
    tools = { ...tools, ...clientTools }
  }

  return { clients, tools }
}
