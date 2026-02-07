/**
 * @license
 * Copyright 2025 BrowserOS
 */

import type { Page } from 'puppeteer-core'
import type { CdpContext } from '../cdp-based/context/cdp-context'
import type { SessionBrowserState } from '../session-browser-state'

export type CdpToolContext = {
  readonly cdp: CdpContext
  readonly page: Page
  readonly state: SessionBrowserState
}
