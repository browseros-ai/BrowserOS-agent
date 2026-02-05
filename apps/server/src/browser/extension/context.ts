/**
 * @license
 * Copyright 2025 BrowserOS
 */
import { TIMEOUTS } from '@browseros/shared/constants/timeouts'

import type { Context } from '../../tools/controller-based/types/context'

import type { ControllerBridge } from './bridge'

export class ControllerContext implements Context {
  constructor(private controllerBridge: ControllerBridge) {}

  async executeAction(action: string, payload: unknown): Promise<unknown> {
    return this.controllerBridge.sendRequest(
      action,
      payload,
      TIMEOUTS.CONTROLLER_DEFAULT,
    )
  }

  isConnected(): boolean {
    return this.controllerBridge.isConnected()
  }

  get bridge(): ControllerBridge {
    return this.controllerBridge
  }
}

export class ScopedControllerContext implements Context {
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
