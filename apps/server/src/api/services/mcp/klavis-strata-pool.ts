import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { RegisteredTool } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { KlavisClient } from '../../../lib/clients/klavis/klavis-client'
import { logger } from '../../../lib/logger'
import {
  registerKlavisTools,
  type KlavisToolDescriptor,
  type KlavisToolCallResult,
} from './klavis-tool-proxy'

const POOL_TTL_MS = 30 * 60 * 1000 // 30 minutes
const EVICTION_INTERVAL_MS = 5 * 60 * 1000 // 5 minutes

interface PoolEntry {
  strataUrl: string
  tools: KlavisToolDescriptor[]
  registeredTools: RegisteredTool[]
  registeredNames: string[]
  expiresAt: number
}

export class KlavisStrataPool {
  private entries = new Map<string, PoolEntry>()
  private toolToKey = new Map<string, string>()
  private registeredKlavisNames = new Set<string>()
  private pending = new Map<string, Promise<void>>()
  private evictionTimer: ReturnType<typeof setInterval>

  constructor(
    private klavisClient: KlavisClient,
    private mcpServer: McpServer,
    private browserToolNames: Set<string>,
  ) {
    this.evictionTimer = setInterval(() => this.evictExpired(), EVICTION_INTERVAL_MS)
  }

  async ensureTools(
    browserosId: string,
    enabledServers?: string[],
  ): Promise<void> {
    const cacheKey = this.computeCacheKey(browserosId, enabledServers)

    const existing = this.entries.get(cacheKey)
    if (existing && existing.expiresAt > Date.now()) {
      return
    }

    const pendingPromise = this.pending.get(cacheKey)
    if (pendingPromise) {
      await pendingPromise
      return
    }

    const creation = this.createEntry(browserosId, enabledServers, cacheKey)
    this.pending.set(cacheKey, creation)

    try {
      await creation
    } finally {
      this.pending.delete(cacheKey)
    }
  }

  async executeToolCall(
    toolName: string,
    args: Record<string, unknown>,
  ): Promise<KlavisToolCallResult> {
    const key = this.toolToKey.get(toolName)
    if (!key) {
      return {
        content: [{ type: 'text' as const, text: `Unknown Klavis tool: ${toolName}` }],
        isError: true,
      }
    }

    const entry = this.entries.get(key)
    if (!entry) {
      return {
        content: [{ type: 'text' as const, text: `Klavis pool entry not found for tool: ${toolName}` }],
        isError: true,
      }
    }

    try {
      const response = await fetch(entry.strataUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/call',
          params: { name: toolName, arguments: args },
        }),
      })

      const json = await response.json() as {
        result?: { content?: KlavisToolCallResult['content']; isError?: boolean }
        error?: { message?: string }
      }

      if (json.error) {
        return {
          content: [{ type: 'text' as const, text: json.error.message || 'Klavis tool call failed' }],
          isError: true,
        }
      }

      return {
        content: json.result?.content || [{ type: 'text' as const, text: 'No content returned' }],
        isError: json.result?.isError,
      }
    } catch (error) {
      const errorText = error instanceof Error ? error.message : String(error)
      logger.error(`Klavis tool call failed: ${toolName}`, { error: errorText })

      return {
        content: [{ type: 'text' as const, text: errorText }],
        isError: true,
      }
    }
  }

  dispose(): void {
    clearInterval(this.evictionTimer)
    for (const [key, entry] of this.entries) {
      this.removeEntry(key, entry)
    }
    this.entries.clear()
    this.toolToKey.clear()
    this.registeredKlavisNames.clear()
    this.pending.clear()
  }

  private computeCacheKey(
    browserosId: string,
    enabledServers?: string[],
  ): string {
    if (!enabledServers) {
      return `${browserosId}:__auto__`
    }
    return `${browserosId}:${[...enabledServers].sort().join(',')}`
  }

  private async createEntry(
    browserosId: string,
    enabledServers: string[] | undefined,
    cacheKey: string,
  ): Promise<void> {
    try {
      let servers = enabledServers

      if (!servers) {
        const integrations = await this.klavisClient.getUserIntegrations(browserosId)
        servers = integrations
          .filter((i) => i.isAuthenticated)
          .map((i) => i.name)
      }

      if (servers.length === 0) {
        logger.info('No Klavis servers to register (empty server list)')
        return
      }

      const strata = await this.klavisClient.createStrata(browserosId, servers)
      const strataUrl = strata.strataServerUrl

      const response = await fetch(strataUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/list',
          params: {},
        }),
      })

      const json = await response.json() as {
        result?: { tools?: KlavisToolDescriptor[] }
      }

      const tools: KlavisToolDescriptor[] = json.result?.tools || []

      if (tools.length === 0) {
        logger.info('No Klavis tools discovered from Strata')
        return
      }

      // Evict existing entry for this key if present
      const oldEntry = this.entries.get(cacheKey)
      if (oldEntry) {
        this.removeEntry(cacheKey, oldEntry)
      }

      const { registeredTools, registeredNames } = registerKlavisTools(this.mcpServer, tools, {
        browserToolNames: this.browserToolNames,
        registeredKlavisNames: this.registeredKlavisNames,
        executeToolCall: (toolName, args) => this.executeToolCall(toolName, args),
      })

      const entry: PoolEntry = {
        strataUrl,
        tools,
        registeredTools,
        registeredNames,
        expiresAt: Date.now() + POOL_TTL_MS,
      }

      this.entries.set(cacheKey, entry)

      for (const tool of tools) {
        this.toolToKey.set(tool.name, cacheKey)
      }

      logger.info(`Klavis Strata pool entry created`, {
        cacheKey,
        toolCount: tools.length,
      })
    } catch (error) {
      const errorText = error instanceof Error ? error.message : String(error)
      logger.error('Failed to create Klavis Strata pool entry', {
        cacheKey,
        error: errorText,
      })
    }
  }

  private removeEntry(key: string, entry: PoolEntry): void {
    for (const registered of entry.registeredTools) {
      try {
        registered.remove()
      } catch {
        // Tool may already have been removed
      }
    }
    for (const name of entry.registeredNames) {
      this.registeredKlavisNames.delete(name)
    }
    for (const tool of entry.tools) {
      this.toolToKey.delete(tool.name)
    }
    this.entries.delete(key)
  }

  private evictExpired(): void {
    const now = Date.now()
    for (const [key, entry] of this.entries) {
      if (entry.expiresAt <= now) {
        logger.info('Evicting expired Klavis Strata pool entry', { cacheKey: key })
        this.removeEntry(key, entry)
      }
    }
  }
}
