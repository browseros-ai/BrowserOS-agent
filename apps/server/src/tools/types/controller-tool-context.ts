/**
 * @license
 * Copyright 2025 BrowserOS
 */

import type { SessionBrowserState } from '../session-browser-state'

export type ControllerToolContext = {
  readonly controller: {
    executeAction(action: string, payload: unknown): Promise<unknown>
    isConnected(): boolean
  }
  readonly state: SessionBrowserState
}
