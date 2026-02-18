/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { TIMEOUTS } from '@browseros/shared/constants/timeouts'
import type { ControllerBridge } from './bridge'

export class ControllerClient {
  constructor(
    private readonly bridge: ControllerBridge,
    private readonly windowId?: number,
  ) {}

  async executeAction(action: string, payload: unknown): Promise<unknown> {
    const enriched =
      this.windowId != null
        ? { ...(payload as Record<string, unknown>), windowId: this.windowId }
        : payload

    return this.bridge.sendRequest(
      action,
      enriched,
      TIMEOUTS.CONTROLLER_DEFAULT,
    )
  }

  isConnected(): boolean {
    return this.bridge.isConnected()
  }
}
