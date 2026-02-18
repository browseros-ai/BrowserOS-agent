/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { TIMEOUTS } from '@browseros/shared/constants/timeouts'
import type { ControllerBridge } from './bridge'

export class ControllerClient {
  constructor(
    private controllerBridge: ControllerBridge,
    private windowId?: number,
  ) {}

  async executeAction(action: string, payload: unknown): Promise<unknown> {
    const enriched =
      this.windowId != null
        ? { ...(payload as Record<string, unknown>), windowId: this.windowId }
        : payload
    return this.controllerBridge.sendRequest(
      action,
      enriched,
      TIMEOUTS.CONTROLLER_DEFAULT,
    )
  }

  isConnected(): boolean {
    return this.controllerBridge.isConnected()
  }
}
