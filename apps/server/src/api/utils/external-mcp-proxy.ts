/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * External MCP server proxy utilities.
 * Connects to Klavis OAuth MCP servers, discovers their tools,
 * and creates proxy wrappers for the /mcp route.
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { CallToolResult, Tool } from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'
import { KlavisClient } from '../../lib/clients/klavis/klavis-client'
import { logger } from '../../lib/logger'

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
}

const DISCOVERY_CACHE_TTL_MS = 5 * 60 * 1000
const discoveryCache = new Map<string, CachedDiscovery>()

/**
 * Fetch authenticated Klavis integrations and create a strata server URL.
 * Returns the strata URL and list of authenticated server names, or null if none.
 */
export async function resolveKlavisStrata(
  browserosId: string,
): Promise<{ url: string; servers: string[] } | null> {
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
    return null
  }

  const strata = await klavisClient.createStrata(browserosId, authenticated)

  logger.debug('Klavis strata created', {
    strataServerUrl: strata.strataServerUrl,
    addedServers: strata.addedServers,
  })

  return { url: strata.strataServerUrl, servers: authenticated }
}

/**
 * Discover tools from a Klavis strata server.
 * Results are cached with a 5-minute TTL.
 */
export async function discoverExternalTools(
  strataUrl: string,
  cacheKey: string,
): Promise<ProxyToolMeta[]> {
  const cached = discoveryCache.get(cacheKey)
  if (cached && Date.now() < cached.expiresAt) {
    return cached.tools
  }

  const client = new Client({
    name: 'browseros-mcp-proxy',
    version: '1.0.0',
  })

  const transport = new StreamableHTTPClientTransport(new URL(strataUrl))

  try {
    logger.debug('Connecting to Klavis strata MCP server', { url: strataUrl })
    await client.connect(transport)

    const response = await client.listTools()
    logger.debug('Listed tools from Klavis strata', {
      toolCount: response.tools.length,
      tools: response.tools.map((t) => t.name),
    })

    const tools: ProxyToolMeta[] = response.tools.map((tool) => ({
      originalName: tool.name,
      prefixedName: `ext_klavis_${tool.name}`,
      description: tool.description,
      inputSchema: tool.inputSchema,
      annotations: tool.annotations,
      serverUrl: strataUrl,
    }))

    // Only cache successful discoveries
    if (tools.length > 0) {
      discoveryCache.set(cacheKey, {
        tools,
        expiresAt: Date.now() + DISCOVERY_CACHE_TTL_MS,
      })
    }

    return tools
  } catch (error) {
    logger.warn('Failed to discover tools from Klavis strata', {
      url: strataUrl,
      error: error instanceof Error ? error.message : String(error),
    })
    return []
  } finally {
    await transport.close().catch(() => {})
  }
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
 * Each Klavis tool is registered with a prefixed name and a handler
 * that connects to the strata server on-demand.
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

        const transport = new StreamableHTTPClientTransport(
          new URL(tool.serverUrl),
        )

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
