/**
 * @license
 * Copyright 2025 BrowserOS
 */

import type { Page } from 'puppeteer-core'
import type { CdpClient } from '../../browser/cdp/cdp-client'
import type { SessionState } from '../../browser/session-state'

export type CdpToolContext = {
  readonly cdp: CdpClient
  readonly page: Page
  readonly state: SessionState
}
