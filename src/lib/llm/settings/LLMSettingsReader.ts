import { Logging } from '@/lib/utils/Logging'
import { isMockLLMSettings } from '@/config'
import { 
  BrowserOSProvider,
  BrowserOSProvidersConfig,
  BrowserOSProvidersConfigSchema,
  BrowserOSPrefObject,
  BROWSEROS_PREFERENCE_KEYS
} from './browserOSTypes'

// Type definitions for chrome.browserOS API
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

// Default constants
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
  
  /**
   * Set mock provider for testing (DEV MODE ONLY)
   * @param provider - Mock provider configuration
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
    Logging.log('LLMSettingsReader', `Mock provider set: ${provider.name || provider.type}`)
  }
  /**
   * Read the default provider configuration
   * @returns Promise resolving to the default BrowserOS provider
   */
  static async read(): Promise<BrowserOSProvider> {
    try {
      Logging.log('LLMSettingsReader', 'Reading provider settings from BrowserOS preferences')
      
      // Try chrome.browserOS.getPref API
      const provider = await this.readFromBrowserOS()
      if (provider) {
        Logging.log('LLMSettingsReader', `Provider loaded: ${provider.name} (${provider.type})`)
        return provider
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      Logging.log('LLMSettingsReader', `Failed to read settings: ${errorMessage}`, 'error')
    }
    
    // Return default BrowserOS provider if reading fails
    const defaultProvider = this.getDefaultBrowserOSProvider()
    Logging.log('LLMSettingsReader', 'Using default BrowserOS provider')
    return defaultProvider
  }
  
  /**
   * Read all providers configuration
   * @returns Promise resolving to all providers configuration
   */
  static async readAllProviders(): Promise<BrowserOSProvidersConfig> {
    try {
      const config = await this.readProvidersConfig()
      if (config) {
        Logging.log('LLMSettingsReader', `Loaded ${config.providers.length} providers`)
        return config
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      Logging.log('LLMSettingsReader', `Failed to read providers: ${errorMessage}`, 'error')
    }
    
    // Return default config with BrowserOS provider only
    return {
      defaultProviderId: 'browseros',
      providers: [this.getDefaultBrowserOSProvider()]
    }
  }
  
  /**
   * Read from BrowserOS preferences API
   * @returns Promise resolving to the default provider or null
   */
  private static async readFromBrowserOS(): Promise<BrowserOSProvider | null> {
    try {
      const key = BROWSEROS_PREFERENCE_KEYS.PROVIDERS

      // Try chrome.browserOS.getPref first (for BrowserOS browser)
      if ((chrome as any)?.browserOS?.getPref) {
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
          // Migrate providers to ensure they have isDefault field
          if (data.providers) {
            data.providers = data.providers.map((p: any) => ({
              ...p,
              isDefault: p.isDefault !== undefined ? p.isDefault : (p.id === 'browseros')
            }))
          }
          const config = BrowserOSProvidersConfigSchema.parse(data)
          const def = config.providers.find(p => p.id === config.defaultProviderId) || null
          return def
        }
      }

      // Fallback to chrome.storage.local (for development/other browsers)
      const stored = await new Promise<any>((resolve) => {
        chrome.storage?.local?.get(key, (result) => resolve(result))
      })
      const raw = stored?.[key]
      if (!raw) {
        if (isMockLLMSettings()) {
          Logging.log('LLMSettingsReader', 'No stored providers found, using mock provider', 'warning')
          return this.getMockProvider()
        }
        return null
      }
      const data = typeof raw === 'string' ? JSON.parse(raw) : raw
      // Migrate providers to ensure they have isDefault field
      if (data.providers) {
        data.providers = data.providers.map((p: any) => ({
          ...p,
          isDefault: p.isDefault !== undefined ? p.isDefault : (p.id === 'browseros')
        }))
      }
      const config = BrowserOSProvidersConfigSchema.parse(data)
      const def = config.providers.find(p => p.id === config.defaultProviderId) || null
      return def
    } catch (e) {
      if (isMockLLMSettings()) {
        Logging.log('LLMSettingsReader', 'Storage read failed, using mock provider', 'warning')
        return this.getMockProvider()
      }
      return null
    }
  }
  
  /**
   * Read full providers configuration
   * @returns Promise resolving to providers config or null
   */
  private static async readProvidersConfig(): Promise<BrowserOSProvidersConfig | null> {
    try {
      const key = BROWSEROS_PREFERENCE_KEYS.PROVIDERS

      // Try chrome.browserOS.getPref first (for BrowserOS browser)
      if ((chrome as any)?.browserOS?.getPref) {
        Logging.log('LLMSettingsReader', `Reading from chrome.browserOS.getPref with key: ${key}`)
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
          Logging.log('LLMSettingsReader', `BrowserOS pref value type: ${typeof pref.value}`)
          const data = typeof pref.value === 'string' ? JSON.parse(pref.value) : pref.value
          // Migrate providers to ensure they have isDefault field
          if (data.providers) {
            data.providers = data.providers.map((p: any) => ({
              ...p,
              isDefault: p.isDefault !== undefined ? p.isDefault : (p.id === 'browseros')
            }))
          }
          const parsed = BrowserOSProvidersConfigSchema.parse(data)
          Logging.log('LLMSettingsReader', `Parsed ${parsed.providers.length} providers from BrowserOS prefs`)
          return parsed
        }
      }

      // Fallback to chrome.storage.local (for development/other browsers)
      Logging.log('LLMSettingsReader', `Fallback: Reading from chrome.storage.local with key: ${key}`)
      const stored = await new Promise<any>((resolve) => {
        chrome.storage?.local?.get(key, (result) => resolve(result))
      })
      const raw = stored?.[key]
      Logging.log('LLMSettingsReader', `Raw storage value type: ${typeof raw}`)
      if (!raw) {
        Logging.log('LLMSettingsReader', 'No providers found in storage')
        return null
      }
      const data = typeof raw === 'string' ? JSON.parse(raw) : raw
      // Migrate providers to ensure they have isDefault field
      if (data.providers) {
        data.providers = data.providers.map((p: any) => ({
          ...p,
          isDefault: p.isDefault !== undefined ? p.isDefault : (p.id === 'browseros')
        }))
      }
      const parsed = BrowserOSProvidersConfigSchema.parse(data)
      Logging.log('LLMSettingsReader', `Parsed ${parsed.providers.length} providers from storage`)
      return parsed
    } catch (_e) {
      Logging.log('LLMSettingsReader', `Error reading providers: ${_e}`, 'error')
      return null
    }
  }
  
  /**
   * Get default BrowserOS built-in provider
   * @returns Default BrowserOS provider configuration
   */
  private static getDefaultBrowserOSProvider(): BrowserOSProvider {
    return {
      id: 'browseros',
      name: 'BrowserOS',
      type: 'browseros',
      isDefault: true,  // BrowserOS is always default
      isBuiltIn: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  }
  
  /**
   * Get mock provider for development
   * @returns Mock provider configuration
   */
  private static getMockProvider(): BrowserOSProvider {
    // Return custom mock if set
    if (this.mockProvider) {
      return this.mockProvider
    }
    
    // Can be overridden via environment
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
