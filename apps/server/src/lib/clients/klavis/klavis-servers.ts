/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { Klavis } from 'klavis'

export const KLAVIS_SERVERS = Object.values(Klavis.McpServerName).map(
  (name) => ({
    name,
    description: '',
  }),
)
