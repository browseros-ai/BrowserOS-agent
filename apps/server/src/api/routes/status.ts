/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { Hono } from 'hono'
import type { ControllerBridge } from '../../browser/extension/bridge'

interface StatusDeps {
  controllerBridge: ControllerBridge
}

export function createStatusRoute(deps: StatusDeps) {
  const { controllerBridge } = deps

  return new Hono().get('/', (c) =>
    c.json({
      status: 'ok',
      extensionConnected: controllerBridge.isConnected(),
    }),
  )
}
