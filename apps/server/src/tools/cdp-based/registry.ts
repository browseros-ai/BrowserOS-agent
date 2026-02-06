/**
 * @license
 * Copyright 2025 BrowserOS
 */

import type { ToolDefinition } from '../types/tool-definition'

import * as consoleTools from './console'
import * as emulationTools from './emulation'
import * as extensionTools from './extensions'
import * as inputTools from './input'
import * as networkTools from './network'
import * as pagesTools from './pages'
import * as performanceTools from './performance'
import * as screenshotTools from './screenshot'
import * as scriptTools from './script'
import * as snapshotTools from './snapshot'

/**
 * All available CDP-based browser automation tools (CDP / DevTools protocol).
 */
// biome-ignore lint/suspicious/noExplicitAny: heterogeneous tool registry requires any
export const allCdpTools: Array<ToolDefinition<any>> = [
  ...Object.values(consoleTools),
  ...Object.values(emulationTools),
  ...Object.values(extensionTools),
  ...Object.values(inputTools),
  ...Object.values(networkTools),
  ...Object.values(pagesTools),
  ...Object.values(performanceTools),
  ...Object.values(screenshotTools),
  ...Object.values(scriptTools),
  ...Object.values(snapshotTools),
].filter(
  (v) => typeof v === 'object' && v !== null && 'handler' in v && 'name' in v,
  // biome-ignore lint/suspicious/noExplicitAny: heterogeneous tool registry
) as Array<ToolDefinition<any>>
