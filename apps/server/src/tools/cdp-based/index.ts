/**
 * @license
 * Copyright 2025 BrowserOS
 */
import type { ToolDefinition } from '../types/tool-definition'

import * as consoleTools from './console'
import * as networkTools from './network'

/**
 * All available CDP-based browser automation tools
 */
// biome-ignore lint/suspicious/noExplicitAny: heterogeneous tool collection requires any
export const allCdpTools: Array<ToolDefinition<any>> = [
  //FIXME: nikhil - figure out the better wway to enable/disable tools
  ...Object.values(consoleTools),
  // ...Object.values(emulationTools),
  // ...Object.values(inputTools),
  ...Object.values(networkTools),
  // ...Object.values(pagesTools),
  // Performance tools disabled due to chrome-devtools-frontend dependency issues
  // ...Object.values(performanceTools),
  // ...Object.values(screenshotTools),
  // ...Object.values(scriptTools),
  // ...Object.values(snapshotTools),
]

// Re-export individual tool modules for selective imports
export * as console from './console'
export * as emulation from './emulation'
export * as input from './input'
export * as network from './network'
export * as pages from './pages'
// export * as performance from './performance';
export * as screenshot from './screenshot'
export * as script from './script'
export * as snapshot from './snapshot'
