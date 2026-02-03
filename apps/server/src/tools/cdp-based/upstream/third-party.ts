/**
 * @license
 * Copyright 2025 BrowserOS
 *
 * Re-export selected third-party dependencies used by the imported
 * chrome-devtools-mcp CDP toolchain.
 */

import 'core-js/modules/es.promise.with-resolvers.js'
import 'core-js/modules/es.set.union.v2.js'
import 'core-js/proposals/iterator-helpers.js'

export type {
  CallToolResult,
  ImageContent,
  TextContent,
} from '@modelcontextprotocol/sdk/types.js'
export type { Debugger } from 'debug'
export { default as debug } from 'debug'
export type * from 'puppeteer-core'
export {
  CDPSessionEvent,
  default as puppeteer,
  KnownDevices,
  Locator,
  PredefinedNetworkConditions,
} from 'puppeteer-core'
export type { CdpPage } from 'puppeteer-core/internal/cdp/Page.js'
export { z as zod } from 'zod'
