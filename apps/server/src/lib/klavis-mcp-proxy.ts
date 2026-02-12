/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Upstream Klavis MCP proxy: connects to Strata, discovers tools,
 * proxies tool calls, and handles periodic refresh.
 */

import { TIMEOUTS } from '@browseros/shared/constants/timeouts'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import type { CallToolResult, Tool } from '@modelcontextprotocol/sdk/types.js'
import type { KlavisClient } from './clients/klavis/klavis-client'
import { logger } from './logger'

export class KlavisMcpProxy {
  private client: Client | null = null
  private transport: StreamableHTTPClientTransport | null = null
  private tools: Tool[] = []
  private authenticatedServerNames: string[] = []
  private refreshInterval: ReturnType<typeof setInterval> | null = null

  onToolsChanged: (() => void) | null = null

  constructor(
    private klavisClient: KlavisClient,
    private browserosId: string,
  ) {}

  async connect(): Promise<void> {
    try {
      const integrations = await this.klavisClient.getUserIntegrations(
        this.browserosId,
      )
      const authenticated = integrations.filter((i) => i.isAuthenticated)
      const names = authenticated.map((i) => i.name)

      if (names.length === 0) {
        this.tools = []
        this.authenticatedServerNames = []
        logger.info('No authenticated Klavis integrations found')
        return
      }

      const result = await this.klavisClient.createStrata(
        this.browserosId,
        names,
      )

      const client = new Client({
        name: 'browseros-klavis-proxy',
        version: '1.0.0',
      })

      const transport = new StreamableHTTPClientTransport(
        new URL(result.strataServerUrl),
      )

      await client.connect(transport)

      const listResult = await client.listTools(undefined, {
        signal: AbortSignal.timeout(TIMEOUTS.MCP_UPSTREAM_LIST_TOOLS),
      })

      this.client = client
      this.transport = transport
      this.tools = listResult.tools as Tool[]
      this.authenticatedServerNames = names

      logger.info('Connected to Klavis Strata', {
        toolCount: this.tools.length,
        servers: names,
      })

      this.onToolsChanged?.()

      this.refreshInterval = setInterval(() => {
        this.refresh().catch((e) => {
          logger.warn('Periodic Klavis MCP proxy refresh failed', {
            error: e instanceof Error ? e.message : String(e),
          })
        })
      }, TIMEOUTS.MCP_UPSTREAM_REFRESH_INTERVAL)
    } catch (error) {
      logger.warn('Failed to connect to Klavis Strata', {
        error: error instanceof Error ? error.message : String(error),
      })
      this.tools = []
    }
  }

  getTools(): Tool[] {
    return this.tools
  }

  async callTool(
    name: string,
    args: Record<string, unknown>,
  ): Promise<CallToolResult> {
    if (!this.client) {
      return {
        content: [{ type: 'text', text: 'Klavis MCP proxy is not connected' }],
        isError: true,
      }
    }

    const result = await this.client.callTool(
      { name, arguments: args },
      undefined,
      { signal: AbortSignal.timeout(TIMEOUTS.MCP_UPSTREAM_TOOL_CALL) },
    )

    // The SDK may return { toolResult } for compatibility — normalize to CallToolResult
    if ('toolResult' in result) {
      return {
        content: [{ type: 'text', text: JSON.stringify(result.toolResult) }],
      }
    }

    return result as CallToolResult
  }

  async refresh(): Promise<void> {
    try {
      const integrations = await this.klavisClient.getUserIntegrations(
        this.browserosId,
      )
      const authenticated = integrations.filter((i) => i.isAuthenticated)
      const names = authenticated.map((i) => i.name).sort()
      const currentNames = [...this.authenticatedServerNames].sort()

      if (
        names.length === currentNames.length &&
        names.every((n, i) => n === currentNames[i])
      ) {
        return
      }

      logger.info('Klavis integration set changed, reconnecting', {
        previous: currentNames,
        current: names,
      })

      await this.disconnectClient()
      await this.connect()
    } catch (error) {
      logger.warn('Failed to refresh Klavis MCP proxy', {
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  async disconnect(): Promise<void> {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval)
      this.refreshInterval = null
    }
    await this.disconnectClient()
  }

  isConnected(): boolean {
    return this.client !== null && this.tools.length > 0
  }

  private async disconnectClient(): Promise<void> {
    try {
      await this.transport?.close()
    } catch {
      // Ignore close errors
    }
    this.client = null
    this.transport = null
    this.tools = []
  }
}
