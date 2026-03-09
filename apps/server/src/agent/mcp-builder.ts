import { createMCPClient } from '@ai-sdk/mcp'
import { Experimental_StdioMCPTransport as StdioMCPTransport } from '@ai-sdk/mcp/mcp-stdio'
import type { BrowserContext } from '@browseros/shared/schemas/browser-context'
import type { ToolSet } from 'ai'
import type { KlavisClient } from '../lib/clients/klavis/klavis-client'
import { logger } from '../lib/logger'

export type McpServerSpec =
  | {
      type: 'url'
      name: string
      url: string
      transport: 'http' | 'sse'
      headers?: Record<string, string>
    }
  | {
      type: 'stdio'
      name: string
      command: string
      args?: string[]
      cwd?: string
      env?: Record<string, string>
    }

export interface McpServerSpecDeps {
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

  // Klavis Strata MCP servers (managed — still auto-detected)
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
        type: 'url',
        name: 'klavis-strata',
        url: result.strataServerUrl,
        transport: 'http',
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

  // User-provided custom MCP servers — transport is explicit, no probing
  if (deps.browserContext?.customMcpServers?.length) {
    for (const server of deps.browserContext.customMcpServers) {
      if (server.transport === 'stdio') {
        specs.push({
          type: 'stdio',
          name: `custom-${server.name}`,
          command: server.command,
          args: server.args,
          cwd: server.cwd,
          env: server.env,
        })
      } else {
        specs.push({
          type: 'url',
          name: `custom-${server.name}`,
          url: server.url,
          transport: server.transport,
          headers: server.headers,
        })
      }
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
    try {
      const client =
        spec.type === 'stdio'
          ? await createMCPClient({
              transport: new StdioMCPTransport({
                command: spec.command,
                args: spec.args,
                env: spec.env,
                cwd: spec.cwd,
              }),
            })
          : await createMCPClient({
              transport: {
                type: spec.transport === 'sse' ? 'sse' : 'http',
                url: spec.url,
                headers: spec.headers,
              },
            })

      clients.push(client)
      const clientTools = await client.tools()
      tools = { ...tools, ...clientTools }
    } catch (error) {
      logger.error('Failed to connect to MCP server', {
        name: spec.name,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  return { clients, tools }
}
