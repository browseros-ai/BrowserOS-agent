/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import type { CdpClient } from '../../../browser/cdp/cdp-client'
import type { PageRegistry } from '../../../browser/page-registry'
import type { SessionState } from '../../../browser/session-state'

export type CdpToolContext = {
  readonly cdp: CdpClient
  readonly registry: PageRegistry
  readonly state: SessionState
}
