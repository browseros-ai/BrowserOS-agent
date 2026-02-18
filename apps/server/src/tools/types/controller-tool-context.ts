/**
 * @license
 * Copyright 2025 BrowserOS
 */

import type { SessionState } from '../../browser/session-state'

export type ControllerToolContext = {
  readonly controller: {
    executeAction(action: string, payload: unknown): Promise<unknown>
    isConnected(): boolean
  }
  readonly state: SessionState
}
