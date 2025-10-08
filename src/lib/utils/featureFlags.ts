import { getBrowserOSAdapter } from '@/lib/browser/BrowserOSAdapter'
import { Logging } from '@/lib/utils/Logging'

// Feature flag definitions with minimum version requirements
const FEATURE_FLAGS = {
  TEACH_MODE: '137.0.7212.69',
} as const

// Version comparison utility
class VersionUtils {
  // Parse "137.0.7207.69" → [137, 0, 7207, 69]
  private static parseVersion(version: string): number[] {
    return version.split('.').map(n => parseInt(n, 10) || 0)
  }

  // Compare if versionA >= versionB
  static isVersionAtLeast(current: string, required: string): boolean {
    const currentParts = this.parseVersion(current)
    const requiredParts = this.parseVersion(required)

    for (let i = 0; i < Math.max(currentParts.length, requiredParts.length); i++) {
      const curr = currentParts[i] || 0
      const req = requiredParts[i] || 0

      if (curr > req) return true
      if (curr < req) return false
    }
    return true  // Equal versions
  }
}

export class FeatureFlags {
  private static instance: FeatureFlags | null = null
  private browserVersion: string | null = null
  private initialized = false

  private constructor() {}

  static getInstance(): FeatureFlags {
    if (!this.instance) {
      this.instance = new FeatureFlags()
    }
    return this.instance
  }

  // Initialize and cache browser version
  async initialize(): Promise<void> {
    if (this.initialized) return

    try {
      const adapter = getBrowserOSAdapter()
      this.browserVersion = await adapter.getVersion()
      this.initialized = true
      Logging.log('FeatureFlags', `Initialized with BrowserOS version: ${this.browserVersion}`)
    } catch (error) {
      Logging.log('FeatureFlags', `Failed to get BrowserOS version, using defaults: ${error}`)
      this.initialized = true
    }
  }

  // Check if a specific feature is enabled
  isEnabled(feature: keyof typeof FEATURE_FLAGS): boolean {
    if (!this.browserVersion) {
      Logging.log('FeatureFlags', `No version available, feature '${feature}' disabled`)
      return false
    }

    const requiredVersion = FEATURE_FLAGS[feature]
    const enabled = VersionUtils.isVersionAtLeast(this.browserVersion, requiredVersion)

    Logging.log(
      'FeatureFlags',
      `Feature '${feature}' requires v${requiredVersion}, ` +
      `current v${this.browserVersion}: ${enabled ? 'ENABLED' : 'DISABLED'}`
    )

    return enabled
  }

  // Get current browser version
  getVersion(): string | null {
    return this.browserVersion
  }

  // List all features and their status
  getFeatureStatus(): Record<string, { required: string; enabled: boolean }> {
    const status: Record<string, { required: string; enabled: boolean }> = {}

    for (const [feature, version] of Object.entries(FEATURE_FLAGS)) {
      status[feature] = {
        required: version,
        enabled: this.isEnabled(feature as keyof typeof FEATURE_FLAGS)
      }
    }

    return status
  }
}

// Export singleton getter for convenience
export const getFeatureFlags = () => FeatureFlags.getInstance()
