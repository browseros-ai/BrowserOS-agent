/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import type { ControllerClient } from '../../../browser/extension/controller-client'
import type { PageRegistry } from '../../../browser/page-registry'
import type { SessionState } from '../../../browser/session-state'

export type ControllerToolContext = {
  readonly controller: ControllerClient
  readonly registry: PageRegistry
  readonly state: SessionState
}
