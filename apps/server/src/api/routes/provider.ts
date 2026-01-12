/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { testProviderConnection } from '../../agent/provider-adapter/test-provider'
import { VercelAIConfigSchema } from '../../agent/provider-adapter/types'
import { logger } from '../../lib/logger'

export function createProviderRoutes() {
  return new Hono().post(
    '/',
    zValidator('json', VercelAIConfigSchema),
    async (c) => {
      const config = c.req.valid('json')

      logger.info('Testing provider connection', {
        provider: config.provider,
        model: config.model,
      })

      const result = await testProviderConnection(config)

      logger.info('Provider test result', {
        provider: config.provider,
        model: config.model,
        success: result.success,
        responseTime: result.responseTime,
      })

      return c.json(result, result.success ? 200 : 400)
    },
  )
}
