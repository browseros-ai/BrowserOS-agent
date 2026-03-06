/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import {
  getAllProviders,
  getProviderModels,
} from '@browseros/models-dev/registry'
import { Hono } from 'hono'

export function createModelsRoutes() {
  return new Hono()
    .get('/', (c) => {
      // Return provider summary with model counts
      const providers = getAllProviders()
      const summary = Object.fromEntries(
        Object.entries(providers).map(([id, p]) => [
          id,
          {
            id: p.id,
            name: p.name,
            modelCount: Object.keys(p.models).length,
          },
        ]),
      )
      return c.json(summary)
    })
    .get('/:provider', (c) => {
      const provider = c.req.param('provider')
      const info = getProviderModels(provider)
      if (!info) return c.json({ error: 'Provider not found' }, 404)
      return c.json(info)
    })
}
