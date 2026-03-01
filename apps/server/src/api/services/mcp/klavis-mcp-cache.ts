import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import type { KlavisClient } from '../../../lib/clients/klavis/klavis-client'
import { logger } from '../../../lib/logger'

const CACHE_TTL_MS = 30 * 60 * 1000 // 30 minutes

interface CachedEntry {
  client: Client
  transport: StreamableHTTPClientTransport
  strataServerUrl: string
  expiresAt: number
}

export class KlavisMcpClientCache {
  private cache = new Map<string, CachedEntry>()

  async getOrCreate(
    browserosId: string,
    servers: string[],
    klavisClient: KlavisClient,
  ): Promise<Client> {
    const key = browserosId
    const cached = this.cache.get(key)

    if (cached && Date.now() < cached.expiresAt) {
      return cached.client
    }

    if (cached) {
      await this.closeEntry(cached)
      this.cache.delete(key)
    }

    const result = await klavisClient.createStrata(browserosId, servers)

    const client = new Client({
      name: 'browseros-klavis-proxy',
      version: '1.0.0',
    })

    const transport = new StreamableHTTPClientTransport(
      new URL(result.strataServerUrl),
    )

    await client.connect(transport)

    this.cache.set(key, {
      client,
      transport,
      strataServerUrl: result.strataServerUrl,
      expiresAt: Date.now() + CACHE_TTL_MS,
    })

    logger.info('Created Klavis MCP client connection', {
      browserosId: browserosId.slice(0, 12),
      strataUrl: result.strataServerUrl,
    })

    return client
  }

  async invalidate(browserosId: string): Promise<void> {
    const entry = this.cache.get(browserosId)
    if (entry) {
      await this.closeEntry(entry)
      this.cache.delete(browserosId)
    }
  }

  async closeAll(): Promise<void> {
    for (const [key, entry] of this.cache) {
      await this.closeEntry(entry)
      this.cache.delete(key)
    }
  }

  private async closeEntry(entry: CachedEntry): Promise<void> {
    try {
      await entry.transport.close()
    } catch {
      // Connection may already be closed
    }
  }
}
