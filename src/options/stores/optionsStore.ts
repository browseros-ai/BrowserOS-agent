import { create } from 'zustand'
import {
  BrowserOSProvider,
  BrowserOSProvidersConfig,
  BrowserOSProvidersConfigSchema,
  BROWSEROS_PREFERENCE_KEYS,
  createDefaultProvidersConfig
} from '@/lib/llm/settings/browserOSTypes'


interface OptionsStore {
  providers: BrowserOSProvider[]
  defaultProviderId: string
  isLoading: boolean
  error: string | null

  // Actions
  loadProviders: () => Promise<void>
  setProviders: (providers: BrowserOSProvider[]) => Promise<void>
  setDefaultProvider: (providerId: string) => Promise<void>
  addProvider: (provider: BrowserOSProvider) => Promise<void>
  updateProvider: (provider: BrowserOSProvider) => Promise<void>
  deleteProvider: (providerId: string) => Promise<void>
}


// Merge two provider configs, deduplicating by provider.id
const mergeProviderConfigs = (
  config1: BrowserOSProvidersConfig | null,
  config2: BrowserOSProvidersConfig | null
): BrowserOSProvidersConfig | null => {
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

const readProvidersFromPrefs = async (): Promise<BrowserOSProvidersConfig | null> => {
  const key = BROWSEROS_PREFERENCE_KEYS.PROVIDERS
  let browserOSConfig: BrowserOSProvidersConfig | null = null
  let storageLocalConfig: BrowserOSProvidersConfig | null = null

  // Read from BrowserOS prefs
  if ((chrome as any)?.browserOS?.getPref) {
    try {
      const pref = await new Promise<any>((resolve, reject) => {
        (chrome as any).browserOS.getPref(key, (pref: any) => {
          if (chrome.runtime?.lastError) {
            reject(chrome.runtime.lastError)
          } else {
            resolve(pref)
          }
        })
      })

      if (pref?.value) {
        const data = typeof pref.value === 'string' ? JSON.parse(pref.value) : pref.value
        browserOSConfig = BrowserOSProvidersConfigSchema.parse(data)
      }
    } catch (error) {
      // Silently continue to fallback
    }
  }

  // Read from chrome.storage.local
  if (chrome.storage?.local) {
    try {
      const stored = await new Promise<Record<string, unknown>>((resolve) => {
        chrome.storage.local.get(key, (result) => resolve(result ?? {}))
      })
      const raw = stored?.[key]
      if (raw) {
        const data = typeof raw === 'string' ? JSON.parse(raw) : raw
        storageLocalConfig = BrowserOSProvidersConfigSchema.parse(data)
      }
    } catch (error) {
      console.error('[optionsStore] Failed to read from chrome.storage.local:', error)
    }
  }

  // Merge both configs
  const mergedConfig = mergeProviderConfigs(browserOSConfig, storageLocalConfig)

  if (!mergedConfig) {
    return null
  }

  // Check if merge recovered providers - auto-save if recovery happened
  const browserOSCount = browserOSConfig?.providers.length || 0
  const storageLocalCount = storageLocalConfig?.providers.length || 0
  const mergedCount = mergedConfig.providers.length

  if (mergedCount > browserOSCount || mergedCount > storageLocalCount) {
    await writeProvidersToPrefs(mergedConfig)
  }

  return mergedConfig
}

const writeProvidersToPrefs = async (config: BrowserOSProvidersConfig): Promise<boolean> => {
  const key = BROWSEROS_PREFERENCE_KEYS.PROVIDERS
  const configJson = JSON.stringify(config)

  let browserOSSuccess = false
  let storageSuccess = false

  // Save to chrome.browserOS.setPref (for BrowserOS browser)
  if ((chrome as any)?.browserOS?.setPref) {
    browserOSSuccess = await new Promise<boolean>((resolve) => {
      (chrome as any).browserOS.setPref(key, configJson, undefined, (success?: boolean) => {
        const error = chrome.runtime?.lastError
        if (error) {
          console.warn('[optionsStore] BrowserOS setPref error:', error.message)
          resolve(false)
        } else if (success !== false) {
          resolve(true)
        } else {
          console.warn('[optionsStore] BrowserOS setPref returned false')
          resolve(false)
        }
      })
    })
  }

  // ALSO save to chrome.storage.local (always, for extension reliability)
  if (chrome.storage?.local) {
    storageSuccess = await new Promise((resolve) => {
      chrome.storage.local.set({ [key]: configJson }, () => {
        if (chrome.runtime?.lastError) {
          console.error('[optionsStore] chrome.storage.local save error:', chrome.runtime.lastError.message)
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
    console.error('[optionsStore] Failed to save to any storage mechanism')
  }
  return success
}


export const useOptionsStore = create<OptionsStore>((set, get) => ({
  providers: [],
  defaultProviderId: 'browseros',
  isLoading: false,
  error: null,

  loadProviders: async () => {
    set({ isLoading: true, error: null })

    try {
      const config = await readProvidersFromPrefs()

      if (config) {
        const normalizedProviders = config.providers.map(p => ({
          ...p,
          isDefault: p.id === config.defaultProviderId
        }))

        set({
          providers: normalizedProviders,
          defaultProviderId: config.defaultProviderId,
          isLoading: false
        })
        return
      }

      const defaultConfig = createDefaultProvidersConfig()
      await writeProvidersToPrefs(defaultConfig)
      set({
        providers: defaultConfig.providers,
        defaultProviderId: defaultConfig.defaultProviderId,
        isLoading: false
      })
    } catch (error) {
      console.error('Failed to load providers:', error)
      const fallbackConfig = createDefaultProvidersConfig()
      set({
        error: 'Failed to load providers',
        providers: fallbackConfig.providers,
        defaultProviderId: fallbackConfig.defaultProviderId,
        isLoading: false
      })
    }
  },

  setProviders: async (providers) => {
    const { defaultProviderId } = get()

    // Ensure default provider exists
    let finalDefaultId = defaultProviderId
    if (!providers.find(p => p.id === defaultProviderId)) {
      finalDefaultId = providers[0]?.id || 'browseros'
    }

    // Update isDefault flags
    const normalizedProviders = providers.map(p => ({
      ...p,
      isDefault: p.id === finalDefaultId
    }))

    const config: BrowserOSProvidersConfig = {
      defaultProviderId: finalDefaultId,
      providers: normalizedProviders
    }

    const success = await writeProvidersToPrefs(config)

    if (success) {
      set({
        providers: normalizedProviders,
        defaultProviderId: finalDefaultId
      })
    } else {
      set({ error: 'Failed to save providers' })
    }
  },

  setDefaultProvider: async (providerId) => {
    const { providers } = get()

    // Update isDefault flags
    const normalizedProviders = providers.map(p => ({
      ...p,
      isDefault: p.id === providerId
    }))

    const config: BrowserOSProvidersConfig = {
      defaultProviderId: providerId,
      providers: normalizedProviders
    }

    const success = await writeProvidersToPrefs(config)

    if (success) {
      set({
        providers: normalizedProviders,
        defaultProviderId: providerId
      })
    } else {
      set({ error: 'Failed to set default provider' })
    }
  },

  addProvider: async (provider) => {
    const { providers } = get()

    // Generate unique ID if not provided
    if (!provider.id) {
      provider.id = `provider_${Date.now()}`
    }

    // Set timestamps
    provider.createdAt = new Date().toISOString()
    provider.updatedAt = new Date().toISOString()

    const updatedProviders = [...providers, provider]
    await get().setProviders(updatedProviders)
  },

  updateProvider: async (provider) => {
    const { providers } = get()

    // Update timestamp
    provider.updatedAt = new Date().toISOString()

    const updatedProviders = providers.map(p =>
      p.id === provider.id ? provider : p
    )

    await get().setProviders(updatedProviders)
  },

  deleteProvider: async (providerId) => {
    const { providers, defaultProviderId } = get()

    // Prevent deleting the last provider
    if (providers.length <= 1) {
      set({ error: 'Cannot delete the last provider' })
      return
    }

    // Prevent deleting built-in providers
    const provider = providers.find(p => p.id === providerId)
    if (provider?.isBuiltIn) {
      set({ error: 'Cannot delete built-in providers' })
      return
    }

    const updatedProviders = providers.filter(p => p.id !== providerId)

    // If deleting the default provider, set a new default
    let newDefaultId = defaultProviderId
    if (providerId === defaultProviderId) {
      newDefaultId = updatedProviders[0]?.id || 'browseros'
    }

    await get().setProviders(updatedProviders)
    if (newDefaultId !== defaultProviderId) {
      await get().setDefaultProvider(newDefaultId)
    }
  }
}))











