/**
 * @license
 * Copyright 2025 BrowserOS
 */

// Core module exports
export { ensureBrowserConnected } from './browser'
export { closeDb, getDb, initializeDb } from './db/index'
export type { BrowserOSConfig, LLMConfig, Provider } from './gateway'
export { fetchBrowserOSConfig, getLLMConfigFromProvider } from './gateway'
export { type IdentityConfig, identity } from './identity'
export { Logger, logger } from './logger'
// Type exports
export type {
  McpContext as McpContextType,
  TextSnapshot,
  TextSnapshotNode,
} from './mcp-context'
export { McpContext } from './mcp-context'
export { type MetricsConfig, metrics } from './metrics'
export { Mutex } from './mutex'
export type { TraceResult } from './types'
