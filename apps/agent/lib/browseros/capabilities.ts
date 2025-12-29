import { BrowserOSAdapter } from './adapter'

type VersionTuple = [number, number, number, number]

type FeatureConfig =
  | { minVersion: string; maxVersion?: string }
  | { minVersion?: string; maxVersion: string }

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
}

/**
 * Version requirements for each feature.
 * - minVersion: feature enabled when OS >= this version
 * - maxVersion: feature enabled when OS < this version (for deprecation)
 *
 * TypeScript enforces that every Feature has a config entry.
 * Note: In development mode, all features are enabled regardless of version.
 */
const FEATURE_CONFIG: { [K in Feature]: FeatureConfig } = {
  [Feature.OPENAI_COMPATIBLE_SUPPORT]: { minVersion: '0.33.0.1' },
  [Feature.MANAGED_MCP_SUPPORT]: { minVersion: '0.34.0.0' },
}

function parseVersion(version: string): VersionTuple {
  const parts = version.split('.').map(Number)
  if (parts.length !== 4 || parts.some(Number.isNaN)) {
    throw new Error(`Invalid version format: ${version}`)
  }
  return parts as VersionTuple
}

function compareVersions(a: VersionTuple, b: VersionTuple): number {
  for (let i = 0; i < 4; i++) {
    if (a[i] < b[i]) return -1
    if (a[i] > b[i]) return 1
  }
  return 0
}

let osVersion: VersionTuple | null = null
let initialized = false

/**
 * Version-gated feature capabilities.
 * @public
 */
export const Capabilities = {
  async initialize(): Promise<void> {
    if (initialized) return

    try {
      const adapter = BrowserOSAdapter.getInstance()
      const versionStr = await adapter.getBrowserosVersion()

      if (versionStr) {
        osVersion = parseVersion(versionStr)
      }
    } catch {
      // Version unknown - features will be disabled
    }

    initialized = true
  },

  // In development mode, all features are enabled to simplify testing
  supports(feature: Feature): boolean {
    if (import.meta.env.DEV) {
      return true
    }

    if (!initialized) {
      throw new Error(
        'Capabilities.initialize() must be called before supports()',
      )
    }

    if (!osVersion) {
      return false
    }

    const config = FEATURE_CONFIG[feature]
    if (!config) {
      return false
    }

    if (config.minVersion) {
      const minTuple = parseVersion(config.minVersion)
      if (compareVersions(osVersion, minTuple) < 0) {
        return false
      }
    }

    if (config.maxVersion) {
      const maxTuple = parseVersion(config.maxVersion)
      if (compareVersions(osVersion, maxTuple) >= 0) {
        return false
      }
    }

    return true
  },

  getOsVersion(): string | null {
    if (!osVersion) return null
    return osVersion.join('.')
  },

  isInitialized(): boolean {
    return initialized
  },

  reset(): void {
    osVersion = null
    initialized = false
  },
}
