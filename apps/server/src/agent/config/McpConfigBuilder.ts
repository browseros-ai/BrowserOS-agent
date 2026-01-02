/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { MCPServerConfig } from '@google/gemini-cli-core'
import type { Logger } from '../../common/index.js'
import type { CustomMcpServer } from '../../http/types.js'
import { KlavisClient } from '../klavis/index.js'

interface McpHttpServerOptions {
  httpUrl: string
  headers?: Record<string, string>
  trust?: boolean
}

function createHttpMcpServerConfig(
  options: McpHttpServerOptions,
): MCPServerConfig {
  return new MCPServerConfig(
    undefined, // command (stdio)
    undefined, // args (stdio)
    undefined, // env (stdio)
    undefined, // cwd (stdio)
    undefined, // url (sse transport)
    options.httpUrl, // httpUrl (streamable http)
    options.headers, // headers
    undefined, // tcp (websocket)
    undefined, // timeout
    options.trust, // trust
  )
}

/**
 * Builder for MCP server configurations
 */
export class McpConfigBuilder {
  private servers: Record<string, MCPServerConfig> = {}
  private klavisClient: KlavisClient
  private logger: Logger

  constructor(logger: Logger, klavisClient?: KlavisClient) {
    this.logger = logger
    this.klavisClient = klavisClient ?? new KlavisClient()
  }

  withBrowserOSServer(mcpServerUrl: string): this {
    this.servers['browseros-mcp'] = createHttpMcpServerConfig({
      httpUrl: mcpServerUrl,
      headers: { Accept: 'application/json, text/event-stream' },
      trust: true,
    })
    return this
  }

  async withKlavisStrata(
    browserosId: string,
    enabledServers: string[],
  ): Promise<this> {
    try {
      const result = await this.klavisClient.createStrata(
        browserosId,
        enabledServers,
      )
      this.servers['klavis-strata'] = createHttpMcpServerConfig({
        httpUrl: result.strataServerUrl,
        trust: true,
      })
      this.logger.info('Added Klavis Strata MCP server', {
        browserosId: browserosId.slice(0, 12),
        servers: enabledServers,
      })
    } catch (error) {
      this.logger.error('Failed to create Klavis Strata MCP server', {
        browserosId: browserosId.slice(0, 12),
        servers: enabledServers,
        error: error instanceof Error ? error.message : String(error),
      })
    }
    return this
  }

  withCustomServers(servers: CustomMcpServer[]): this {
    for (const server of servers) {
      this.servers[`custom-${server.name}`] = createHttpMcpServerConfig({
        httpUrl: server.url,
        trust: true,
      })
      this.logger.info('Added custom MCP server', {
        name: server.name,
        url: server.url,
      })
    }
    return this
  }

  build(): Record<string, MCPServerConfig> | undefined {
    return Object.keys(this.servers).length > 0 ? this.servers : undefined
  }
}
