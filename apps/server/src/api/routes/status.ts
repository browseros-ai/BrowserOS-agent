/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { Hono } from 'hono'
import type { ControllerBackend } from '../../browser/backends/controller'

interface StatusDeps {
  controller: ControllerBackend
}

export function createStatusRoute(deps: StatusDeps) {
  const { controller } = deps

  return new Hono().get('/', (c) =>
    c.json({
      status: 'ok',
      extensionConnected: controller.isConnected(),
    }),
  )
}
