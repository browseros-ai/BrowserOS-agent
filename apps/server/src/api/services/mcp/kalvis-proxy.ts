/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Proxy for Kalvis MCP tools.
 * Connects to Kalvis Strata as an MCP client and exposes tools through BrowserOS MCP server.
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import type { Tool } from '@modelcontextprotocol/sdk/types.js'
import type { KlavisClient } from '../../../lib/clients/klavis/klavis-client'
import { logger } from '../../../lib/logger'

export interface KlavisProxyConfig {
  browserosId: string
  servers: string[]
  cacheTtlMs?: number
}

export interface KlavisToolDefinition {
  name: string
  originalName: string
  serverName: string
  description: string
  inputSchema: Record<string, unknown>
}

interface CachedTools {
  tools: KlavisToolDefinition[]
  strataUrl: string
  fetchedAt: number
  expiresAt: number
}

export interface KlavisToolCallResult {
  content: Array<{ type: 'text' | 'image'; text?: string; data?: string; mimeType?: string }>
  isError?: boolean
}

const KALVIS_TOOL_PREFIX = 'klavis_'
const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000

export class KlavisToolProxy {
  private cache: CachedTools | null = null
  private client: Client | null = null
  private transport: StreamableHTTPClientTransport | null = null
  private klavisClient: KlavisClient
  private config: KlavisProxyConfig | null = null

  constructor(klavisClient: KlavisClient) {
    this.klavisClient = klavisClient
  }

  async initialize(config: KlavisProxyConfig): Promise<void> {
    this.config = config

    if (!config.servers.length) {
      logger.debug('No Kalvis servers configured, skipping initialization')
      return
    }

    try {
      const strata = await this.klavisClient.createStrata(
        config.browserosId,
        config.servers,
      )

      this.cache = {
        tools: [],
        strataUrl: strata.strataServerUrl,
        fetchedAt: Date.now(),
        expiresAt: Date.now() + (config.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS),
      }

      await this.connectToStrata(strata.strataServerUrl)
      await this.fetchTools()

      logger.info('KlavisToolProxy initialized', {
        servers: config.servers,
        toolCount: this.cache.tools.length,
        browserosId: config.browserosId.slice(0, 12),
      })
    } catch (error) {
      logger.error('Failed to initialize KlavisToolProxy', {
        error: error instanceof Error ? error.message : String(error),
        servers: config.servers,
      })
      throw error
    }
  }

  private async connectToStrata(strataUrl: string): Promise<void> {
    this.client = new Client({
      name: 'browseros-kalvis-proxy',
      version: '1.0.0',
    })

    this.transport = new StreamableHTTPClientTransport(new URL(strataUrl), {
      requestInit: {
        headers: { 'X-BrowserOS-Source': 'kalvis-proxy' },
      },
    })

    await this.client.connect(this.transport)
  }

  private async fetchTools(): Promise<void> {
    if (!this.client || !this.cache) {
      throw new Error('Client not connected')
    }

    const result = await this.client.listTools()
    const tools: KlavisToolDefinition[] = []

    for (const tool of result.tools) {
      const transformed = this.transformTool(tool)
      tools.push(transformed)
    }

    this.cache.tools = tools
    this.cache.fetchedAt = Date.now()
    this.cache.expiresAt = Date.now() + (this.config?.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS)
  }

  private transformTool(tool: Tool): KlavisToolDefinition {
    const serverName = this.extractServerName(tool.name)
    const prefixedName = `${KALVIS_TOOL_PREFIX}${tool.name}`

    return {
      name: prefixedName,
      originalName: tool.name,
      serverName,
      description: tool.description || `Kalvis tool: ${tool.name}`,
      inputSchema: tool.inputSchema as Record<string, unknown>,
    }
  }

  private extractServerName(toolName: string): string {
    const parts = toolName.split('_')
    return parts[0] || 'unknown'
  }

  getTools(): KlavisToolDefinition[] {
    return this.cache?.tools ?? []
  }

  async callTool(
    prefixedName: string,
    args: Record<string, unknown>,
  ): Promise<KlavisToolCallResult> {
    if (!this.client) {
      return {
        content: [{ type: 'text', text: 'Kalvis proxy not initialized' }],
        isError: true,
      }
    }

    if (!prefixedName.startsWith(KALVIS_TOOL_PREFIX)) {
      return {
        content: [{ type: 'text', text: `Invalid Kalvis tool name: ${prefixedName}` }],
        isError: true,
      }
    }

    const originalName = prefixedName.slice(KALVIS_TOOL_PREFIX.length)

    try {
      logger.debug('Calling Kalvis tool', { originalName, prefixedName })

      const result = await this.client.callTool({
        name: originalName,
        arguments: args,
      })

      return {
        content: result.content as KlavisToolCallResult['content'],
        isError: result.isError,
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      logger.error('Kalvis tool call failed', {
        tool: originalName,
        error: errorMessage,
      })

      return {
        content: [{ type: 'text', text: `Kalvis tool error: ${errorMessage}` }],
        isError: true,
      }
    }
  }

  isKalvisTool(name: string): boolean {
    return name.startsWith(KALVIS_TOOL_PREFIX)
  }

  async refreshIfExpired(): Promise<void> {
    if (!this.cache || !this.config) {
      return
    }

    if (Date.now() > this.cache.expiresAt) {
      logger.debug('Kalvis tool cache expired, refreshing')
      await this.fetchTools()
    }
  }

  async dispose(): Promise<void> {
    if (this.transport) {
      try {
        await this.transport.close()
      } catch (error) {
        logger.warn('Error closing Kalvis transport', {
          error: error instanceof Error ? error.message : String(error),
        })
      }
      this.transport = null
    }
    this.client = null
    this.cache = null
    this.config = null
  }

  isInitialized(): boolean {
    return this.client !== null && this.cache !== null
  }

  getToolCount(): number {
    return this.cache?.tools.length ?? 0
  }
}

export function createKlavisToolProxy(klavisClient: KlavisClient): KlavisToolProxy {
  return new KlavisToolProxy(klavisClient)
}

export { KALVIS_TOOL_PREFIX }
