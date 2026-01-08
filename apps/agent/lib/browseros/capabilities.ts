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

let browserOSVersion: number[] | null = null
let serverVersion: number[] | null = null
let initialized = false

/**
 * Version-gated feature capabilities.
 * @public
 */
export const Capabilities = {
  async initialize(): Promise<void> {
    if (initialized) return

    const adapter = BrowserOSAdapter.getInstance()

    try {
      const versionStr = await adapter.getBrowserosVersion()
      if (versionStr) {
        browserOSVersion = parseVersion(versionStr)
      }
    } catch {
      // BrowserOS version unknown - features requiring it will be disabled
    }

    try {
      const pref = await adapter.getPref(SERVER_VERSION_PREF)
      if (pref?.value) {
        serverVersion = parseVersion(pref.value)
      }
    } catch {
      // Server version unknown - features requiring it will be disabled
    }

    initialized = true
  },

  // In development mode, all features are enabled to simplify testing
  supports(feature: Feature): boolean {
    if (import.meta.env.DEV) return true
    if (!initialized) {
      throw new Error(
        'Capabilities.initialize() must be called before supports()',
      )
    }

    const config = FEATURE_CONFIG[feature]
    if (!config) return false

    const hasBrowserOSConstraints =
      config.minBrowserOSVersion || config.maxBrowserOSVersion
    if (
      hasBrowserOSConstraints &&
      !checkVersionConstraints(
        browserOSVersion,
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
        serverVersion,
        config.minServerVersion,
        config.maxServerVersion,
      )
    ) {
      return false
    }

    return true
  },

  getBrowserOSVersion(): string | null {
    if (!browserOSVersion) return null
    return browserOSVersion.join('.')
  },

  getServerVersion(): string | null {
    if (!serverVersion) return null
    return serverVersion.join('.')
  },

  isInitialized(): boolean {
    return initialized
  },

  reset(): void {
    browserOSVersion = null
    serverVersion = null
    initialized = false
  },
}
