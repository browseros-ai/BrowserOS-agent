/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

// @ts-expect-error chrome-devtools-mcp has no type declarations
import { tools } from 'chrome-devtools-mcp/build/src/tools/tools.js'

export const allCdpTools: Array<{
  name: string
  description: string
  schema: Record<string, unknown>
  annotations: Record<string, unknown>
  handler: (
    request: { params: Record<string, unknown> },
    response: unknown,
    context: unknown,
  ) => Promise<void>
}> = tools
