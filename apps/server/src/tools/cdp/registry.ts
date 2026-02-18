/**
 * @license
 * Copyright 2025 BrowserOS
 */

import * as inputTools from './tools/input'
import * as pagesTools from './tools/pages'
import * as screenshotTools from './tools/screenshot'
import * as scriptTools from './tools/script'
import * as snapshotTools from './tools/snapshot'
import type { CdpToolDefinition } from './types/cdp-tool-definition'

/**
 * All available CDP-based browser automation tools (CDP / DevTools protocol).
 */
// biome-ignore lint/suspicious/noExplicitAny: heterogeneous tool registry requires any
export const allCdpTools: Array<CdpToolDefinition<any>> = [
  ...Object.values(inputTools),
  ...Object.values(pagesTools),
  ...Object.values(screenshotTools),
  ...Object.values(scriptTools),
  ...Object.values(snapshotTools),
].filter(
  (v) => typeof v === 'object' && v !== null && 'handler' in v && 'name' in v,
  // biome-ignore lint/suspicious/noExplicitAny: heterogeneous tool registry
) as Array<CdpToolDefinition<any>>
