import { BrowserOSAdapter } from './adapter'

const SERVER_VERSION_PREF = 'browseros.server.version'

type FeatureConfig = {
  minBrowserOSVersion?: string
  maxBrowserOSVersion?: string
  minServerVersion?: string
  maxServerVersion?: string
}

/**
 * Features gated by BrowserOS version.
 * Add new features here with corresponding config in FEATURE_CONFIG.
 *
 * Note: In development mode, all features are enabled regardless of version.
 * @public
 */
export enum Feature {
  // support for OpenAI-compatible provider
  OPENAI_COMPATIBLE_SUPPORT = 'OPENAI_COMPATIBLE_SUPPORT',
  // Managed MCP servers integration
  MANAGED_MCP_SUPPORT = 'MANAGED_MCP_SUPPORT',
  // Chat personalization via system prompt
  PERSONALIZATION_SUPPORT = 'PERSONALIZATION_SUPPORT',
  // Unified port: agent uses MCP port instead of separate agent port
  UNIFIED_PORT_SUPPORT = 'UNIFIED_PORT_SUPPORT',
  // Toolbar customization settings
  CUSTOMIZATION_SUPPORT = 'CUSTOMIZATION_SUPPORT',
  // Workspace folder selection with full path support requires new browserOS.choosePath API
  WORKSPACE_FOLDER_SUPPORT = 'WORKSPACE_FOLDER_SUPPORT',
  // Workflows feature
  WORKFLOW_SUPPORT = 'WORKFLOW_SUPPORT',
}

/**
 * Version requirements for each feature.
 * - minBrowserOSVersion: feature enabled when BrowserOS >= this version
 * - maxBrowserOSVersion: feature enabled when BrowserOS < this version (for deprecation)
 * - minServerVersion: feature enabled when server >= this version
 * - maxServerVersion: feature enabled when server < this version (for deprecation)
 *
 * TypeScript enforces that every Feature has a config entry.
 * Note: In development mode, all features are enabled regardless of version.
 */
const FEATURE_CONFIG: { [K in Feature]: FeatureConfig } = {
  [Feature.OPENAI_COMPATIBLE_SUPPORT]: { minBrowserOSVersion: '0.33.0.1' },
  [Feature.MANAGED_MCP_SUPPORT]: { minBrowserOSVersion: '0.34.0.0' },
  [Feature.PERSONALIZATION_SUPPORT]: { minBrowserOSVersion: '0.36.1.0' },
  [Feature.UNIFIED_PORT_SUPPORT]: { minBrowserOSVersion: '0.36.1.0' },
  [Feature.CUSTOMIZATION_SUPPORT]: { minBrowserOSVersion: '0.36.1.0' },
  [Feature.WORKSPACE_FOLDER_SUPPORT]: { minBrowserOSVersion: '0.36.4.0' },
  [Feature.WORKFLOW_SUPPORT]: { minServerVersion: '0.0.41' },
}

function parseVersion(version: string): number[] {
  const parts = version.split('.').map(Number)
  if (parts.length < 2 || parts.some(Number.isNaN)) {
    throw new Error(`Invalid version format: ${version}`)
  }
  return parts
}

function compareVersions(a: number[], b: number[]): number {
  const maxLen = Math.max(a.length, b.length)
  for (let i = 0; i < maxLen; i++) {
    const aVal = a[i] ?? 0
    const bVal = b[i] ?? 0
    if (aVal < bVal) return -1
    if (aVal > bVal) return 1
  }
  return 0
}

function checkVersionConstraints(
  version: number[] | null,
  minVersionStr?: string,
  maxVersionStr?: string,
): boolean {
  if (!version) return false
  if (
    minVersionStr &&
    compareVersions(version, parseVersion(minVersionStr)) < 0
  )
    return false
  if (
    maxVersionStr &&
    compareVersions(version, parseVersion(maxVersionStr)) >= 0
  )
    return false
  return true
}

type CapabilitiesState = {
  browserOSVersion: number[] | null
  serverVersion: number[] | null
}

let initPromise: Promise<CapabilitiesState> | null = null

async function doInitialize(): Promise<CapabilitiesState> {
  const adapter = BrowserOSAdapter.getInstance()
  const state: CapabilitiesState = {
    browserOSVersion: null,
    serverVersion: null,
  }

  try {
    const versionStr = await adapter.getBrowserosVersion()
    if (versionStr) {
      state.browserOSVersion = parseVersion(versionStr)
    }
  } catch {
    // BrowserOS version unknown - features requiring it will be disabled
  }

  try {
    const pref = await adapter.getPref(SERVER_VERSION_PREF)
    if (pref?.value) {
      state.serverVersion = parseVersion(pref.value)
    }
  } catch {
    // Server version unknown - features requiring it will be disabled
  }

  return state
}

function ensureInitialized(): Promise<CapabilitiesState> {
  if (!initPromise) {
    initPromise = doInitialize()
  }
  return initPromise
}

function checkFeatureSupport(
  state: CapabilitiesState,
  feature: Feature,
): boolean {
  const config = FEATURE_CONFIG[feature]
  if (!config) return false

  const hasBrowserOSConstraints =
    config.minBrowserOSVersion || config.maxBrowserOSVersion
  if (
    hasBrowserOSConstraints &&
    !checkVersionConstraints(
      state.browserOSVersion,
      config.minBrowserOSVersion,
      config.maxBrowserOSVersion,
    )
  ) {
    return false
  }

  const hasServerConstraints =
    config.minServerVersion || config.maxServerVersion
  if (
    hasServerConstraints &&
    !checkVersionConstraints(
      state.serverVersion,
      config.minServerVersion,
      config.maxServerVersion,
    )
  ) {
    return false
  }

  return true
}

/**
 * Version-gated feature capabilities.
 * All methods auto-initialize and are safe to call at any time.
 * @public
 */
export const Capabilities = {
  /**
   * Check if a feature is supported.
   * In development mode, all features are enabled.
   */
  async supports(feature: Feature): Promise<boolean> {
    if (import.meta.env.DEV) return true
    const state = await ensureInitialized()
    return checkFeatureSupport(state, feature)
  },

  async getBrowserOSVersion(): Promise<string | null> {
    const state = await ensureInitialized()
    if (!state.browserOSVersion) return null
    return state.browserOSVersion.join('.')
  },

  async getServerVersion(): Promise<string | null> {
    const state = await ensureInitialized()
    if (!state.serverVersion) return null
    return state.serverVersion.join('.')
  },

  /**
   * Pre-initialize capabilities. Optional - methods auto-initialize if needed.
   * Useful for warming up before first use.
   */
  async initialize(): Promise<void> {
    await ensureInitialized()
  },

  /**
   * Reset state for testing purposes.
   */
  reset(): void {
    initPromise = null
  },
}

// Pre-initialize when module is imported
ensureInitialized()
