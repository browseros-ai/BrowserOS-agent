import { Logging } from '@/lib/utils/Logging'
import { isMockLLMSettings } from '@/config'
import { 
  LLMSettings, 
  LLMSettingsSchema, 
  PREFERENCE_KEYS,
  ProviderType 
} from './types'

// Type definitions for chrome.settingsPrivate API
declare global {
  namespace chrome {
    namespace settingsPrivate {
      interface PrefObject {
        key?: string
        type?: string
        value?: any
        controlledBy?: string
        enforcement?: string
        recommendedValue?: any
        userControlDisabled?: boolean
      }
      
      function getPref(name: string, callback: (pref: PrefObject) => void): void
      function setPref(name: string, value: any, pageId: string, callback?: (success: boolean) => void): void
      function getAllPrefs(callback: (prefs: PrefObject[]) => void): void
      const onPrefsChanged: {
        addListener(callback: (prefs: PrefObject[]) => void): void
        removeListener(callback: (prefs: PrefObject[]) => void): void
      }
    }
  }
}

/**
 * Mock preference values for development mode
 * 
 * IMPORTANT: These are mock values for development/testing only!
 * They will only be used when:
 * 1. DEV_MODE is true in src/config.ts
 * 2. chrome.settingsPrivate API is not available
 * 
 * To test different providers, change 'nxtscape.default_provider' to:
 * - 'nxtscape' (default) - Uses Nxtscape proxy, no real API key needed
 * - 'openai' - Would require real API key in production
 * - 'anthropic' - Would require real API key in production
 * - 'gemini' - Would require real Google AI API key in production
 * - 'ollama' - Requires local Ollama server running
 */
const MOCK_PREFERENCES: Record<string, string | undefined> = {
  'nxtscape.default_provider': 'nxtscape',  // Change this to test different providers
  'nxtscape.nxtscape_model': 'gpt-4o-mini',
  'nxtscape.openai_api_key': 'TBD',
  'nxtscape.openai_model': 'gpt-4o',
  'nxtscape.openai_base_url': undefined,
  'nxtscape.anthropic_api_key': 'TBD',
  'nxtscape.anthropic_model': 'claude-3-5-sonnet-latest',
  'nxtscape.anthropic_base_url': undefined,
  'nxtscape.gemini_api_key': 'TBD',
  'nxtscape.gemini_model': 'gemini-2.0-flash',
  'nxtscape.gemini_base_url': undefined,
  'nxtscape.ollama_base_url': 'http://localhost:11434',
  'nxtscape.ollama_model': 'qwen3:4b',
  'nxtscape.ollama_api_key': undefined,  // Optional
  'nxtscape.lmstudio_model': 'lmstudio-default-model',
  'nxtscape.lmstudio_base_url': undefined,
  'nxtscape.openrouter_model': 'openrouter/horizon-beta',
  'nxtscape.openrouter_api_key': 'TBD',
  'nxtscape.openrouter_base_url': undefined,
}

/**
 * Reads LLM settings from browser preferences
 */
export class LLMSettingsReader {
  /**
   * Override mock preferences for testing (DEV MODE ONLY)
   * @param overrides - Partial preferences to override
   */
  static setMockPreferences(overrides: Partial<typeof MOCK_PREFERENCES>): void {
    if (!isMockLLMSettings()) {
      Logging.log('LLMSettingsReader', 'setMockPreferences is only available in development mode', 'warning')
      return
    }
    
    Object.assign(MOCK_PREFERENCES, overrides)
    Logging.log('LLMSettingsReader', `Mock preferences updated: ${JSON.stringify(overrides)}`)
  }
  /**
   * Read all LLM settings from Chrome storage
   * @returns Promise resolving to LLM settings
   */
  static async read(): Promise<LLMSettings> {
    try {
      Logging.log('LLMSettingsReader', 'Reading LLM settings from Chrome preferences')
      
      // Get all preference values from Chrome storage
      const preferences = await this.getPreferences()
      
      // Construct settings object
      const settings: LLMSettings = {
        defaultProvider: this.getProviderType(preferences[PREFERENCE_KEYS.DEFAULT_PROVIDER]),
        nxtscape: {
          model: preferences[PREFERENCE_KEYS.NXTSCAPE_MODEL]
        },
        openai: {
          apiKey: preferences[PREFERENCE_KEYS.OPENAI_API_KEY],
          model: preferences[PREFERENCE_KEYS.OPENAI_MODEL],
          baseUrl: preferences[PREFERENCE_KEYS.OPENAI_BASE_URL]
        },
        anthropic: {
          apiKey: preferences[PREFERENCE_KEYS.ANTHROPIC_API_KEY],
          model: preferences[PREFERENCE_KEYS.ANTHROPIC_MODEL],
          baseUrl: preferences[PREFERENCE_KEYS.ANTHROPIC_BASE_URL]
        },
        gemini: {
          apiKey: preferences[PREFERENCE_KEYS.GEMINI_API_KEY],
          model: preferences[PREFERENCE_KEYS.GEMINI_MODEL],
          baseUrl: preferences[PREFERENCE_KEYS.GEMINI_BASE_URL]
        },
        ollama: {
          apiKey: preferences[PREFERENCE_KEYS.OLLAMA_API_KEY],
          baseUrl: preferences[PREFERENCE_KEYS.OLLAMA_BASE_URL],
          model: preferences[PREFERENCE_KEYS.OLLAMA_MODEL]
        },
        lmstudio: {
          model: preferences[PREFERENCE_KEYS.LMSTUDIO_MODEL],
          baseUrl: preferences[PREFERENCE_KEYS.LMSTUDIO_BASE_URL],
        },
        openrouter: {
          apiKey: preferences[PREFERENCE_KEYS.OPENROUTER_API_KEY],
          model: preferences[PREFERENCE_KEYS.OPENROUTER_MODEL],
          baseUrl: preferences[PREFERENCE_KEYS.OPENROUTER_BASE_URL],
        }
      }
      
      // Validate with Zod schema
      const validated = LLMSettingsSchema.parse(settings)
      
      Logging.log('LLMSettingsReader', `Settings loaded successfully. Provider: ${validated.defaultProvider}`)
      
      return validated
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      Logging.log('LLMSettingsReader', `Failed to read settings: ${errorMessage}`, 'error')
      
      // Return default settings on error
      return {
        defaultProvider: 'nxtscape',
        nxtscape: {},
        openai: {},
        anthropic: {},
        gemini: {},
        ollama: {},
        lmstudio: {},
        openrouter: {}
      }
    }
  }
  
  /**
   * Get preferences from Chrome settings
   * @returns Promise resolving to preference values
   */
  private static async getPreferences(): Promise<Record<string, string | undefined>> {
    // Check if chrome.settingsPrivate is available
    if (typeof chrome === 'undefined' || !chrome.settingsPrivate || !chrome.settingsPrivate.getPref) {
      // In development mode, return mock values for testing
      if (isMockLLMSettings()) {
        Logging.log('LLMSettingsReader', 'Chrome settingsPrivate API not available, using mock values for development', 'warning')
        Logging.log('LLMSettingsReader', `Mock provider: ${MOCK_PREFERENCES['nxtscape.default_provider']}`)
        return MOCK_PREFERENCES
      }
      
      Logging.log('LLMSettingsReader', 'Chrome settingsPrivate API not available, using defaults', 'warning')
      return {}
    }

    // Get all preference values in parallel
    const prefPromises = Object.entries(PREFERENCE_KEYS).map(([key, prefName]) => 
      new Promise<[string, string | undefined]>((resolve) => {
        chrome.settingsPrivate.getPref(prefName, (pref: chrome.settingsPrivate.PrefObject) => {
          if (chrome.runtime.lastError) {
            Logging.log('LLMSettingsReader', 
              `Failed to read preference ${prefName}: ${chrome.runtime.lastError.message}`, 'warning')
            resolve([prefName, undefined])
          } else {
            // Extract the value from the preference object
            const value = pref?.value as string | undefined
            resolve([prefName, value])
          }
        })
      })
    )

    // Wait for all preferences to be fetched
    const prefEntries = await Promise.all(prefPromises)
    
    // Convert array of entries back to object
    return Object.fromEntries(prefEntries)
  }
  
  /**
   * Convert string to provider type with validation
   * @param value - Raw provider value
   * @returns Valid provider type or default
   */
  private static getProviderType(value: string | undefined): ProviderType {
    const validProviders: ProviderType[] = ['nxtscape', 'openai', 'anthropic', 'gemini', 'ollama', 'lmstudio', 'openrouter']
    
    if (value && validProviders.includes(value as ProviderType)) {
      return value as ProviderType
    }
    
    return 'nxtscape' // Default provider
  }
  
  /**
   * Read a single preference value
   * @param key - Preference key to read
   * @returns Promise resolving to the preference value
   */
  static async readPreference(key: string): Promise<string | undefined> {
    // Check if chrome.settingsPrivate is available
    if (typeof chrome === 'undefined' || !chrome.settingsPrivate || !chrome.settingsPrivate.getPref) {
      // In development mode, return mock value for testing
      if (isMockLLMSettings()) {
        Logging.log('LLMSettingsReader', `Chrome settingsPrivate API not available, using mock value for ${key}`, 'warning')
        return MOCK_PREFERENCES[key]
      }
      
      Logging.log('LLMSettingsReader', 'Chrome settingsPrivate API not available', 'warning')
      return undefined
    }

    return new Promise((resolve) => {
      chrome.settingsPrivate.getPref(key, (pref: chrome.settingsPrivate.PrefObject) => {
        if (chrome.runtime.lastError) {
          Logging.log('LLMSettingsReader', 
            `Failed to read preference ${key}: ${chrome.runtime.lastError.message}`, 'warning')
          resolve(undefined)
        } else {
          // Extract the value from the preference object
          const value = pref?.value as string | undefined
          resolve(value)
        }
      })
    })
  }
} 
