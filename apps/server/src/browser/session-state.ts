/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import type { Page } from 'puppeteer-core'
import type { TextSnapshot } from '../tools/cdp/context/cdp-context'

export class SessionState {
  #windowId: number | undefined
  #activePageId: number | undefined
  #textSnapshots = new WeakMap<Page, TextSnapshot>()
  #uniqueBackendNodeIdToMcpId = new Map<string, string>()
  #nextSnapshotId = 1

  get windowId(): number | undefined {
    return this.#windowId
  }

  set windowId(value: number | undefined) {
    this.#windowId = value
  }

  get activePageId(): number | undefined {
    return this.#activePageId
  }

  set activePageId(value: number | undefined) {
    this.#activePageId = value
  }

  getTextSnapshot(page: Page): TextSnapshot | undefined {
    return this.#textSnapshots.get(page)
  }

  setTextSnapshot(page: Page, snapshot: TextSnapshot): void {
    this.#textSnapshots.set(page, snapshot)
  }

  get uniqueBackendNodeIdToMcpId(): Map<string, string> {
    return this.#uniqueBackendNodeIdToMcpId
  }

  nextSnapshotId(): number {
    return this.#nextSnapshotId++
  }
}
