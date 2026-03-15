import { createMCPClient } from '@ai-sdk/mcp'
import { Experimental_StdioMCPTransport as StdioMCPTransport } from '@ai-sdk/mcp/mcp-stdio'
import { TIMEOUTS } from '@browseros/shared/constants/timeouts'
import type { ToolSet } from 'ai'
import type { KlavisClient } from '../lib/clients/klavis/klavis-client'
import { logger } from '../lib/logger'
import { getMcpServers } from '../lib/mcp-config'

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
  klavisClient?: KlavisClient
  browserosId?: string
}

export interface McpClientBundle {
  clients: Array<{ close(): Promise<void> }>
  tools: ToolSet
}

// Build MCP specs from mcp.json config file
export async function buildMcpServerSpecs(
  deps: McpServerSpecDeps,
): Promise<McpServerSpec[]> {
  const specs: McpServerSpec[] = []
  const servers = await getMcpServers()

  // Managed servers → Klavis Strata
  const managedNames = servers
    .filter((s) => s.type === 'managed' && s.managedServerName)
    .map((s) => s.managedServerName!)

  if (deps.browserosId && deps.klavisClient && managedNames.length) {
    try {
      const result = await deps.klavisClient.createStrata(
        deps.browserosId,
        managedNames,
      )
      specs.push({
        type: 'url',
        name: 'klavis-strata',
        url: result.strataServerUrl,
        transport: 'http',
      })
      logger.info('Added Klavis Strata MCP server', {
        browserosId: deps.browserosId.slice(0, 12),
        servers: managedNames,
      })
    } catch (error) {
      logger.error('Failed to create Klavis Strata MCP server', {
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  // Custom servers → explicit transport from config
  const customServers = servers.filter((s) => s.type === 'custom')
  for (const server of customServers) {
    const transport = server.config?.transport ?? 'http'

    if (transport === 'stdio' && server.config?.command) {
      specs.push({
        type: 'stdio',
        name: `custom-${server.displayName}`,
        command: server.config.command,
        args: server.config.args,
        cwd: server.config.cwd,
        env: server.config.env,
      })
    } else if (server.config?.url) {
      specs.push({
        type: 'url',
        name: `custom-${server.displayName}`,
        url: server.config.url,
        transport: transport === 'sse' ? 'sse' : 'http',
        headers: server.config.headers,
      })
    }
  }

  return specs
}

// Connect a single MCP client with timeout protection
async function connectMcpClient(
  spec: McpServerSpec,
): Promise<{ client: { close(): Promise<void> }; tools: ToolSet } | null> {
  const timeout = TIMEOUTS.MCP_CLIENT_CONNECT
  try {
    const transport =
      spec.type === 'stdio'
        ? new StdioMCPTransport({
            command: spec.command,
            args: spec.args,
            env: spec.env,
            cwd: spec.cwd,
          })
        : {
            type:
              spec.transport === 'sse' ? ('sse' as const) : ('http' as const),
            url: spec.url,
            headers: spec.headers,
          }

    const client = await Promise.race([
      createMCPClient({ transport }),
      new Promise<never>((_, reject) =>
        setTimeout(
          () =>
            reject(
              new Error(`MCP client connect timed out after ${timeout}ms`),
            ),
          timeout,
        ),
      ),
    ])
    const clientTools = await Promise.race([
      client.tools(),
      new Promise<never>((_, reject) =>
        setTimeout(
          () =>
            reject(
              new Error(`MCP client.tools() timed out after ${timeout}ms`),
            ),
          timeout,
        ),
      ),
    ])
    return { client, tools: clientTools }
  } catch (error) {
    logger.warn('Failed to connect MCP client, skipping', {
      name: spec.name,
      error: error instanceof Error ? error.message : String(error),
    })
    return null
  }
}

// Create MCP clients from specs, return merged toolset
export async function createMcpClients(
  specs: McpServerSpec[],
): Promise<McpClientBundle> {
  const clients: Array<{ close(): Promise<void> }> = []
  let tools: ToolSet = {}

  // Connect all clients concurrently with per-client timeout
  const results = await Promise.all(specs.map(connectMcpClient))
  for (const result of results) {
    if (result) {
      clients.push(result.client)
      tools = { ...tools, ...result.tools }
    }
  }

  return { clients, tools }
}
