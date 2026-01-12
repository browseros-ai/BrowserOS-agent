/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { z } from 'zod'
import { KlavisClient } from '../../lib/clients/klavis/klavis-client'
import { OAUTH_MCP_SERVERS } from '../../lib/clients/klavis/oauth-mcp-servers'
import { logger } from '../../lib/logger'

const ServerNameSchema = z.object({
  serverName: z.string().min(1),
})

interface KlavisRouteDeps {
  browserosId: string
}

export function createKlavisRoutes(deps: KlavisRouteDeps) {
  const { browserosId } = deps
  const klavisClient = new KlavisClient()

  // Chain route definitions for proper Hono RPC type inference
  return new Hono()
    .get('/servers', (c) => {
      return c.json({
        servers: OAUTH_MCP_SERVERS,
        count: OAUTH_MCP_SERVERS.length,
      })
    })
    .get('/oauth-urls', async (c) => {
      if (!browserosId) {
        return c.json({ error: 'browserosId not configured' }, 500)
      }

      try {
        const serverNames = OAUTH_MCP_SERVERS.map((s) => s.name)
        const response = await klavisClient.createStrata(
          browserosId,
          serverNames,
        )

        logger.info('Generated OAuth URLs', {
          browserosId: browserosId.slice(0, 12),
          serverCount: serverNames.length,
        })

        return c.json({
          oauthUrls: response.oauthUrls || {},
          servers: serverNames,
        })
      } catch (error) {
        logger.error('Error getting OAuth URLs', {
          browserosId: browserosId?.slice(0, 12),
          error: error instanceof Error ? error.message : String(error),
        })
        return c.json({ error: 'Failed to get OAuth URLs' }, 500)
      }
    })
    .get('/user-integrations', async (c) => {
      if (!browserosId) {
        return c.json({ error: 'browserosId not configured' }, 500)
      }

      try {
        const integrations = await klavisClient.getUserIntegrations(browserosId)
        logger.info('Fetched user integrations', {
          browserosId: browserosId.slice(0, 12),
          count: integrations.length,
        })
        return c.json({ integrations, count: integrations.length })
      } catch (error) {
        logger.error('Error fetching user integrations', {
          browserosId: browserosId?.slice(0, 12),
          error: error instanceof Error ? error.message : String(error),
        })
        return c.json({ error: 'Failed to fetch user integrations' }, 500)
      }
    })
    .post('/servers/add', zValidator('json', ServerNameSchema), async (c) => {
      if (!browserosId) {
        return c.json({ error: 'browserosId not configured' }, 500)
      }

      const { serverName } = c.req.valid('json')

      const validServer = OAUTH_MCP_SERVERS.find((s) => s.name === serverName)
      if (!validServer) {
        return c.json({ error: `Invalid server: ${serverName}` }, 400)
      }

      logger.info('Adding server to strata', { serverName })

      const result = await klavisClient.createStrata(browserosId, [serverName])

      return c.json({
        success: true,
        serverName,
        strataId: result.strataId,
        addedServers: result.addedServers,
        oauthUrl: result.oauthUrls?.[serverName],
      })
    })
    .delete(
      '/servers/remove',
      zValidator('json', ServerNameSchema),
      async (c) => {
        if (!browserosId) {
          return c.json({ error: 'browserosId not configured' }, 500)
        }

        const { serverName } = c.req.valid('json')

        const validServer = OAUTH_MCP_SERVERS.find((s) => s.name === serverName)
        if (!validServer) {
          return c.json({ error: `Invalid server: ${serverName}` }, 400)
        }

        logger.info('Removing server from strata', { serverName })

        await klavisClient.removeServer(browserosId, serverName)

        return c.json({
          success: true,
          serverName,
        })
      },
    )
}
