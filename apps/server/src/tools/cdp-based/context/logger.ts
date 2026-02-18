/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { debug } from '../third-party'

const mcpDebugNamespace = 'mcp:log'

const namespacesToEnable = [
  mcpDebugNamespace,
  ...(process.env.DEBUG ? [process.env.DEBUG] : []),
]

debug.enable(namespacesToEnable.join(','))

export const logger = debug(mcpDebugNamespace)
