/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Manages a persistent MCP client connection to a Klavis Strata server.
 * Fetches tool definitions at startup and proxies tool calls at runtime.
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import type { KlavisClient } from '../../../lib/clients/klavis/klavis-client'
import { logger } from '../../../lib/logger'

export interface KlavisTool {
  name: string
  description?: string
  inputSchema: {
    type: 'object'
    properties?: Record<string, object>
    required?: string[]
    [key: string]: unknown
  }
}

export class KlavisMcpClientManager {
  private client: Client | null = null
  private transport: StreamableHTTPClientTransport | null = null
  private tools: KlavisTool[] = []
  private strataServerUrl: string | null = null

  constructor(
    private klavisClient: KlavisClient,
    private browserosId: string,
  ) {}

  async initialize(): Promise<void> {
    if (!this.browserosId) {
      logger.info(
        'No browserosId configured, skipping Klavis MCP initialization',
      )
      return
    }

    let authenticatedServers: string[]
    try {
      const integrations = await this.klavisClient.getUserIntegrations(
        this.browserosId,
      )
      authenticatedServers = integrations
        .filter((i) => i.isAuthenticated)
        .map((i) => i.name)
    } catch (error) {
      logger.warn('Failed to fetch Klavis user integrations', {
        error: error instanceof Error ? error.message : String(error),
      })
      return
    }

    if (authenticatedServers.length === 0) {
      logger.info(
        'No authenticated Klavis integrations found, skipping Klavis MCP',
      )
      return
    }

    let strataUrl: string
    try {
      const result = await this.klavisClient.createStrata(
        this.browserosId,
        authenticatedServers,
      )
      strataUrl = result.strataServerUrl
      this.strataServerUrl = strataUrl
      logger.info('Created Klavis Strata for MCP proxy', {
        browserosId: this.browserosId.slice(0, 12),
        servers: authenticatedServers,
        strataUrl,
      })
    } catch (error) {
      logger.warn('Failed to create Klavis Strata', {
        error: error instanceof Error ? error.message : String(error),
      })
      return
    }

    await this.connectAndListTools(strataUrl)
  }

  private async connectAndListTools(strataUrl: string): Promise<void> {
    try {
      this.client = new Client({
        name: 'browseros-klavis-proxy',
        version: '1.0.0',
      })

      this.transport = new StreamableHTTPClientTransport(new URL(strataUrl))

      await this.client.connect(this.transport)

      const result = await this.client.listTools()
      this.tools = (result.tools ?? []).map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema,
      }))

      logger.info('Fetched Klavis tools via MCP client', {
        toolCount: this.tools.length,
        toolNames: this.tools.map((t) => t.name),
      })
    } catch (error) {
      logger.warn('Failed to connect to Klavis Strata MCP server', {
        error: error instanceof Error ? error.message : String(error),
        strataUrl,
      })
      this.tools = []
      await this.cleanup()
    }
  }

  getTools(): KlavisTool[] {
    return this.tools
  }

  async callTool(
    name: string,
    args: Record<string, unknown>,
  ): Promise<{
    content: Array<{ type: string; text?: string }>
    isError?: boolean
  }> {
    if (!this.client) {
      // Attempt one reconnect if we have a strata URL
      if (this.strataServerUrl) {
        logger.info(
          'MCP client disconnected, attempting reconnect for callTool',
        )
        await this.connectAndListTools(this.strataServerUrl)
      }
      if (!this.client) {
        return {
          content: [
            { type: 'text', text: 'Klavis MCP client is not connected' },
          ],
          isError: true,
        }
      }
    }

    try {
      const result = await this.client.callTool({ name, arguments: args })
      return result as {
        content: Array<{ type: string; text?: string }>
        isError?: boolean
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      logger.warn('Klavis callTool failed, attempting reconnect', {
        tool: name,
        error: errorMsg,
      })

      // Single reconnect attempt on failure
      await this.cleanup()
      if (this.strataServerUrl) {
        await this.connectAndListTools(this.strataServerUrl)
        if (this.client) {
          try {
            const retryResult = await this.client.callTool({
              name,
              arguments: args,
            })
            return retryResult as {
              content: Array<{ type: string; text?: string }>
              isError?: boolean
            }
          } catch (retryError) {
            const retryMsg =
              retryError instanceof Error
                ? retryError.message
                : String(retryError)
            logger.error('Klavis callTool retry also failed', {
              tool: name,
              error: retryMsg,
            })
          }
        }
      }

      return {
        content: [
          { type: 'text', text: `Klavis tool call failed: ${errorMsg}` },
        ],
        isError: true,
      }
    }
  }

  private async cleanup(): Promise<void> {
    try {
      await this.transport?.close()
    } catch {
      // Ignore close errors
    }
    this.client = null
    this.transport = null
  }

  async close(): Promise<void> {
    await this.cleanup()
    this.tools = []
    this.strataServerUrl = null
  }
}
