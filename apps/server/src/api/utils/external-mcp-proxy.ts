/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * External MCP server proxy utilities.
 * Connects to external MCP servers (Klavis OAuth apps + custom user servers),
 * discovers their tools, and creates proxy wrappers for the /mcp route.
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { CallToolResult, Tool } from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'
import { KlavisClient } from '../../lib/clients/klavis/klavis-client'
import { logger } from '../../lib/logger'
import {
  detectMcpTransport,
  type McpTransportType,
} from '../../lib/mcp-transport-detect'

export interface CustomMcpServer {
  name: string
  url: string
}

interface ResolvedServer {
  name: string
  url: string
  transport: McpTransportType
  prefix: string
}

interface CachedDiscovery {
  tools: ProxyToolMeta[]
  expiresAt: number
}

interface ProxyToolMeta {
  originalName: string
  prefixedName: string
  description?: string
  inputSchema: Tool['inputSchema']
  annotations?: Tool['annotations']
  serverUrl: string
  transport: McpTransportType
}

const DISCOVERY_CACHE_TTL_MS = 5 * 60 * 1000
const discoveryCache = new Map<string, CachedDiscovery>()

function createClientTransport(
  url: string,
  transport: McpTransportType,
): StreamableHTTPClientTransport | SSEClientTransport {
  if (transport === 'streamable-http') {
    return new StreamableHTTPClientTransport(new URL(url))
  }
  return new SSEClientTransport(new URL(url))
}

/**
 * Fetch authenticated Klavis integrations and create a strata server for them.
 */
async function resolveKlavisServers(
  browserosId: string,
): Promise<ResolvedServer[]> {
  const klavisClient = new KlavisClient()

  const integrations = await klavisClient.getUserIntegrations(browserosId)
  const authenticated = integrations
    .filter((i) => i.isAuthenticated)
    .map((i) => i.name)

  logger.debug('Klavis user integrations', {
    total: integrations.length,
    authenticated,
  })

  if (authenticated.length === 0) {
    return []
  }

  const strata = await klavisClient.createStrata(browserosId, authenticated)

  logger.debug('Klavis strata created', {
    strataServerUrl: strata.strataServerUrl,
    addedServers: strata.addedServers,
  })

  return [
    {
      name: 'klavis-strata',
      url: strata.strataServerUrl,
      transport: 'streamable-http',
      prefix: 'ext_klavis',
    },
  ]
}

/**
 * Resolve external server configurations.
 * Fetches authenticated Klavis integrations when enableIntegrations is true,
 * and resolves custom servers by detecting their transport type.
 */
export async function resolveExternalServers(opts: {
  enableIntegrations: boolean
  customServers: CustomMcpServer[]
  browserosId: string
}): Promise<ResolvedServer[]> {
  const { enableIntegrations, customServers, browserosId } = opts
  const servers: ResolvedServer[] = []

  if (enableIntegrations) {
    try {
      const klavisServers = await resolveKlavisServers(browserosId)
      servers.push(...klavisServers)
    } catch (error) {
      logger.warn('Failed to resolve Klavis integrations for MCP proxy', {
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  if (customServers.length > 0) {
    const results = await Promise.allSettled(
      customServers.map(async (server) => {
        const transport = await detectMcpTransport(server.url)
        return {
          name: server.name,
          url: server.url,
          transport,
          prefix: `ext_${server.name}`,
        } satisfies ResolvedServer
      }),
    )

    for (const result of results) {
      if (result.status === 'fulfilled') {
        servers.push(result.value)
      } else {
        logger.warn('Failed to resolve custom MCP server', {
          error:
            result.reason instanceof Error
              ? result.reason.message
              : String(result.reason),
        })
      }
    }
  }

  return servers
}

/**
 * Discover tools from resolved external servers.
 * Results are cached by server identifiers with a 5-minute TTL.
 */
export async function discoverExternalTools(
  servers: ResolvedServer[],
  cacheKey: string,
): Promise<ProxyToolMeta[]> {
  const cached = discoveryCache.get(cacheKey)
  if (cached && Date.now() < cached.expiresAt) {
    return cached.tools
  }

  const allTools: ProxyToolMeta[] = []

  const results = await Promise.allSettled(
    servers.map(async (server) => {
      const client = new Client({
        name: 'browseros-mcp-proxy',
        version: '1.0.0',
      })

      const transport = createClientTransport(server.url, server.transport)

      try {
        logger.debug('Connecting to external MCP server', {
          name: server.name,
          url: server.url,
          transport: server.transport,
        })
        await client.connect(transport)

        const response = await client.listTools()
        logger.debug('Listed tools from external server', {
          name: server.name,
          toolCount: response.tools.length,
          tools: response.tools.map((t) => t.name),
        })

        return response.tools.map((tool) => ({
          originalName: tool.name,
          prefixedName: `${server.prefix}_${tool.name}`,
          description: tool.description,
          inputSchema: tool.inputSchema,
          annotations: tool.annotations,
          serverUrl: server.url,
          transport: server.transport,
        }))
      } finally {
        await transport.close().catch(() => {})
      }
    }),
  )

  for (const result of results) {
    if (result.status === 'fulfilled') {
      allTools.push(...result.value)
    } else {
      logger.warn('Failed to discover tools from external MCP server', {
        error:
          result.reason instanceof Error
            ? result.reason.message
            : String(result.reason),
      })
    }
  }

  // Only cache successful discoveries — don't cache empty results from failures
  if (allTools.length > 0) {
    discoveryCache.set(cacheKey, {
      tools: allTools,
      expiresAt: Date.now() + DISCOVERY_CACHE_TTL_MS,
    })
  }

  return allTools
}

/**
 * Build a Zod shape from a JSON Schema inputSchema.
 * Preserves property names and required/optional status for MCP tool listing.
 */
function buildZodShape(
  inputSchema: Tool['inputSchema'],
): Record<string, z.ZodTypeAny> {
  const shape: Record<string, z.ZodTypeAny> = {}
  const required = new Set(inputSchema.required ?? [])

  for (const key of Object.keys(inputSchema.properties ?? {})) {
    shape[key] = required.has(key) ? z.any() : z.any().optional()
  }

  return shape
}

/**
 * Register proxy tools on an McpServer instance.
 * Each external tool is registered with a prefixed name and a handler
 * that connects to the external server on-demand.
 */
export function registerProxyTools(
  mcpServer: McpServer,
  tools: ProxyToolMeta[],
): void {
  for (const tool of tools) {
    const zodShape = buildZodShape(tool.inputSchema)

    // @ts-expect-error TS2589: Type instantiation too deep with complex Zod schema generics
    mcpServer.registerTool(
      tool.prefixedName,
      {
        description: tool.description,
        inputSchema: zodShape,
        annotations: tool.annotations,
      },
      (async (params: Record<string, unknown>): Promise<CallToolResult> => {
        const client = new Client({
          name: 'browseros-mcp-proxy',
          version: '1.0.0',
        })

        const transport = createClientTransport(tool.serverUrl, tool.transport)

        try {
          await client.connect(transport)

          const result = await client.callTool({
            name: tool.originalName,
            arguments: params,
          })

          return result as CallToolResult
        } catch (error) {
          const errorText =
            error instanceof Error ? error.message : String(error)
          logger.warn('External MCP tool call failed', {
            tool: tool.prefixedName,
            originalTool: tool.originalName,
            serverUrl: tool.serverUrl,
            error: errorText,
          })
          return {
            content: [
              {
                type: 'text',
                text: `External tool error: ${errorText}`,
              },
            ],
            isError: true,
          }
        } finally {
          await transport.close().catch(() => {})
        }
      }) as (params: Record<string, unknown>) => Promise<CallToolResult>,
    )
  }
}
