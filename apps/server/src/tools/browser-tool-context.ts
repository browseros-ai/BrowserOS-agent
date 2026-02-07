/** @license Copyright 2025 BrowserOS */

import type { Page } from 'puppeteer-core'
import type { ScopedControllerContext } from '../browser/extension/context'
import type { CdpContext } from './cdp-based/context/cdp-context'
import type { SessionBrowserState } from './session-browser-state'

export class BrowserToolContext {
  readonly cdp: CdpContext | null
  readonly controller: ScopedControllerContext
  readonly state: SessionBrowserState
  page?: Page

  constructor(opts: {
    cdp: CdpContext | null
    controller: ScopedControllerContext
    state: SessionBrowserState
  }) {
    this.cdp = opts.cdp
    this.controller = opts.controller
    this.state = opts.state
  }
}
