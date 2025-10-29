import { Logging } from '@/lib/utils/Logging'
import { isMockLLMSettings } from '@/config'
import {
  BrowserOSProvider,
  BrowserOSProvidersConfig,
  BrowserOSProvidersConfigSchema,
  BrowserOSPrefObject,
  BROWSEROS_PREFERENCE_KEYS,
  createDefaultBrowserOSProvider,
  createDefaultProvidersConfig
} from './browserOSTypes'

// Type definitions for chrome.browserOS API (callback-based)
declare global {
  interface ChromeBrowserOS {
    getPref(name: string, callback: (pref: BrowserOSPrefObject) => void): void
    setPref(name: string, value: any, pageId?: string, callback?: (success: boolean) => void): void
    getAllPrefs(callback: (prefs: BrowserOSPrefObject[]) => void): void
  }

  interface Chrome {
    browserOS?: ChromeBrowserOS
  }
}

const DEFAULT_OPENAI_MODEL = 'gpt-4o'
const DEFAULT_ANTHROPIC_MODEL = 'claude-3-5-sonnet-latest'
const DEFAULT_GEMINI_MODEL = 'gemini-2.0-flash'
const DEFAULT_OLLAMA_MODEL = 'qwen3:4b'
const DEFAULT_OLLAMA_BASE_URL = 'http://localhost:11434'

/**
 * Reads LLM provider settings from BrowserOS preferences
 */
export class LLMSettingsReader {
  private static mockProvider: BrowserOSProvider | null = null

  private static parseProvidersConfig(raw: unknown): BrowserOSProvidersConfig | null {
    try {
      const data = typeof raw === 'string' ? JSON.parse(raw) : raw
      if (!data) return null
      const parsed = BrowserOSProvidersConfigSchema.parse(data)
      return this.normalizeConfig(parsed)
    } catch (error) {
      Logging.log('LLMSettingsReader', `Failed to parse providers config: ${error}`, 'error')
      return null
    }
  }

  private static normalizeConfig(config: BrowserOSProvidersConfig): BrowserOSProvidersConfig {
    let defaultProviderId = config.defaultProviderId
    if (!config.providers.some(p => p.id === defaultProviderId)) {
      defaultProviderId = config.providers[0]?.id || 'browseros'
    }

    const normalizedProviders = config.providers.map(provider => ({
      ...provider,
      isDefault: provider.id === defaultProviderId,
      isBuiltIn: provider.isBuiltIn ?? false,
      createdAt: provider.createdAt ?? new Date().toISOString(),
      updatedAt: provider.updatedAt ?? new Date().toISOString()
    }))

    if (normalizedProviders.length === 0) {
      return createDefaultProvidersConfig()
    }

    return {
      defaultProviderId,
      providers: normalizedProviders
    }
  }

  /**
   * Set mock provider for testing (DEV MODE ONLY)
   */
  static setMockProvider(provider: Partial<BrowserOSProvider>): void {
    if (!isMockLLMSettings()) {
      Logging.log('LLMSettingsReader', 'setMockProvider is only available in development mode', 'warning')
      return
    }

    this.mockProvider = {
      ...this.getDefaultBrowserOSProvider(),
      ...provider
    }
  }

  /**
   * Read the default provider configuration
   */
  static async read(): Promise<BrowserOSProvider> {
    try {
      const config = await this.readAllProviders()
      const provider = config.providers.find(p => p.id === config.defaultProviderId)
        || config.providers[0]
        || this.getDefaultBrowserOSProvider()
      return provider
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      Logging.log('LLMSettingsReader', `Failed to read settings: ${errorMessage}`, 'error')
      return this.getDefaultBrowserOSProvider()
    }
  }

  /**
   * Read all providers configuration
   */
  static async readAllProviders(): Promise<BrowserOSProvidersConfig> {
    try {
      const config = await this.readProvidersConfig()
      if (config) {
        return config
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      Logging.log('LLMSettingsReader', `Failed to read providers: ${errorMessage}`, 'error')
    }

    return createDefaultProvidersConfig()
  }

  /**
   * Merge two provider configs, deduplicating by provider.id
   * Prefers providers with newer updatedAt timestamp
   */
  private static mergeProviderConfigs(
    config1: BrowserOSProvidersConfig | null,
    config2: BrowserOSProvidersConfig | null
  ): BrowserOSProvidersConfig | null {
    if (!config1 && !config2) return null
    if (!config1) return config2
    if (!config2) return config1

    // Merge providers by id, preferring newer updatedAt
    const providerMap = new Map<string, BrowserOSProvider>()

    for (const provider of config1.providers) {
      providerMap.set(provider.id, provider)
    }

    for (const provider of config2.providers) {
      const existing = providerMap.get(provider.id)
      if (!existing) {
        providerMap.set(provider.id, provider)
      } else {
        // Prefer provider with newer updatedAt timestamp
        const existingTime = new Date(existing.updatedAt || 0).getTime()
        const newTime = new Date(provider.updatedAt || 0).getTime()
        if (newTime > existingTime) {
          providerMap.set(provider.id, provider)
        }
      }
    }

    const mergedProviders = Array.from(providerMap.values())

    // Use defaultProviderId from config with more providers (or config1 if equal)
    const defaultProviderId = config1.providers.length >= config2.providers.length
      ? config1.defaultProviderId
      : config2.defaultProviderId

    // Ensure default provider exists in merged list
    const finalDefaultId = mergedProviders.some(p => p.id === defaultProviderId)
      ? defaultProviderId
      : (mergedProviders[0]?.id || 'browseros')

    return {
      defaultProviderId: finalDefaultId,
      providers: mergedProviders
    }
  }

  /**
   * Read full providers configuration with MERGE strategy
   * Reads from BOTH storages and merges to recover from stale data overwrites
   */
  private static async readProvidersConfig(): Promise<BrowserOSProvidersConfig | null> {
    try {
      const key = BROWSEROS_PREFERENCE_KEYS.PROVIDERS
      let browserOSConfig: BrowserOSProvidersConfig | null = null
      let storageLocalConfig: BrowserOSProvidersConfig | null = null

      // Read from BrowserOS prefs
      if ((chrome as any)?.browserOS?.getPref) {
        try {
          const pref = await new Promise<BrowserOSPrefObject>((resolve, reject) => {
            (chrome as any).browserOS.getPref(key, (pref: BrowserOSPrefObject) => {
              if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError)
              } else {
                resolve(pref)
              }
            })
          })

          if (pref?.value) {
            const data = typeof pref.value === 'string' ? JSON.parse(pref.value) : pref.value
            // Ensure all providers have isDefault field
            if (data.providers) {
              data.providers = data.providers.map((p: any) => ({
                ...p,
                isDefault: p.isDefault !== undefined ? p.isDefault : (p.id === 'browseros')
              }))
            }
            browserOSConfig = BrowserOSProvidersConfigSchema.parse(data)
          }
        } catch (getPrefError) {
          // Silently continue to fallback
        }
      }

      // Read from chrome.storage.local
      if (chrome.storage?.local) {
        const stored = await new Promise<any>((resolve) => {
          chrome.storage.local.get(key, (result) => resolve(result))
        })
        const raw = stored?.[key]
        if (raw) {
          const data = typeof raw === 'string' ? JSON.parse(raw) : raw
          // Ensure all providers have isDefault field
          if (data.providers) {
            data.providers = data.providers.map((p: any) => ({
              ...p,
              isDefault: p.isDefault !== undefined ? p.isDefault : (p.id === 'browseros')
            }))
          }
          storageLocalConfig = BrowserOSProvidersConfigSchema.parse(data)
        }
      }

      // Merge both configs
      const mergedConfig = this.mergeProviderConfigs(browserOSConfig, storageLocalConfig)

      if (!mergedConfig) {
        return null
      }

      // Check if merge recovered providers - auto-save if recovery happened
      const browserOSCount = browserOSConfig?.providers.length || 0
      const storageLocalCount = storageLocalConfig?.providers.length || 0
      const mergedCount = mergedConfig.providers.length

      if (mergedCount > browserOSCount || mergedCount > storageLocalCount) {
        await this.saveProvidersConfig(mergedConfig)
      }

      return mergedConfig
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : JSON.stringify(error)
      Logging.log('LLMSettingsReader', `Error reading providers: ${errorMessage}`, 'error')
      if (error instanceof Error && error.stack) {
        Logging.log('LLMSettingsReader', `Stack trace: ${error.stack}`, 'error')
      }
      return null
    }
  }

  static async saveProvidersConfig(config: BrowserOSProvidersConfig): Promise<boolean> {
    const normalized = this.normalizeConfig(config)
    const key = BROWSEROS_PREFERENCE_KEYS.PROVIDERS
    const payload = JSON.stringify(normalized)

    let browserOSSuccess = false
    let storageSuccess = false

    // Save to chrome.browserOS.setPref (for BrowserOS browser)
    if ((chrome as any)?.browserOS?.setPref) {
      browserOSSuccess = await new Promise<boolean>((resolve) => {
        (chrome as any).browserOS.setPref(key, payload, undefined, (success?: boolean) => {
          const error = chrome.runtime?.lastError
          if (error) {
            Logging.log('LLMSettingsReader', `BrowserOS setPref error: ${error.message}`, 'warning')
            resolve(false)
          } else if (success !== false) {
            resolve(true)
          } else {
            Logging.log('LLMSettingsReader', 'BrowserOS setPref returned false', 'warning')
            resolve(false)
          }
        })
      })
    }

    // ALSO save to chrome.storage.local (always, for extension reliability)
    if (chrome.storage?.local) {
      storageSuccess = await new Promise((resolve) => {
        chrome.storage.local.set({ [key]: payload }, () => {
          if (chrome.runtime.lastError) {
            Logging.log('LLMSettingsReader', `chrome.storage.local save error: ${chrome.runtime.lastError.message}`, 'error')
            resolve(false)
          } else {
            resolve(true)
          }
        })
      })
    }

    // Success if either storage mechanism worked
    const success = browserOSSuccess || storageSuccess
    if (!success) {
      Logging.log('LLMSettingsReader', 'Failed to save to any storage mechanism', 'error')
    }
    return success
  }

  private static getDefaultBrowserOSProvider(): BrowserOSProvider {
    return createDefaultBrowserOSProvider()
  }

  private static getMockProvider(): BrowserOSProvider {
    if (this.mockProvider) {
      return this.mockProvider
    }

    const mockType = process.env.MOCK_PROVIDER_TYPE || 'browseros'

    const mockProviders: Record<string, BrowserOSProvider> = {
      browseros: this.getDefaultBrowserOSProvider(),
      openai: {
        id: 'mock_openai',
        name: 'Mock OpenAI',
        type: 'openai',
        isDefault: true,
        isBuiltIn: false,
        baseUrl: 'https://api.openai.com/v1',
        apiKey: process.env.OPENAI_API_KEY || 'mock-key',
        modelId: DEFAULT_OPENAI_MODEL,
        capabilities: { supportsImages: true },
        modelConfig: { contextWindow: 128000, temperature: 0.7 },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      anthropic: {
        id: 'mock_anthropic',
        name: 'Mock Anthropic',
        type: 'anthropic',
        isDefault: true,
        isBuiltIn: false,
        baseUrl: 'https://api.anthropic.com',
        apiKey: process.env.ANTHROPIC_API_KEY || 'mock-key',
        modelId: DEFAULT_ANTHROPIC_MODEL,
        capabilities: { supportsImages: true },
        modelConfig: { contextWindow: 200000, temperature: 0.7 },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      gemini: {
        id: 'mock_gemini',
        name: 'Mock Gemini',
        type: 'google_gemini',
        isDefault: true,
        isBuiltIn: false,
        apiKey: process.env.GOOGLE_API_KEY || 'mock-key',
        modelId: DEFAULT_GEMINI_MODEL,
        capabilities: { supportsImages: true },
        modelConfig: { contextWindow: 1000000, temperature: 0.7 },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      ollama: {
        id: 'mock_ollama',
        name: 'Mock Ollama',
        type: 'ollama',
        isDefault: true,
        isBuiltIn: false,
        baseUrl: DEFAULT_OLLAMA_BASE_URL,
        modelId: DEFAULT_OLLAMA_MODEL,
        capabilities: { supportsImages: false },
        modelConfig: { contextWindow: 4096, temperature: 0.7 },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    }

    return mockProviders[mockType] || this.getDefaultBrowserOSProvider()
  }
}







