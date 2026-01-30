/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { Hono } from 'hono'
import type { ControllerContext } from '../../browser/extension/context'

interface StatusDeps {
  controllerContext: ControllerContext
}

export function createStatusRoute(deps: StatusDeps) {
  const { controllerContext } = deps

  return new Hono().get('/', (c) =>
    c.json({
      status: 'ok',
      extensionConnected: controllerContext.isConnected(),
    }),
  )
}
