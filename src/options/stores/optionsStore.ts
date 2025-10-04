import { create } from 'zustand'
import {
  BrowserOSProvider,
  BrowserOSProvidersConfig,
  BrowserOSProvidersConfigSchema,
  BROWSEROS_PREFERENCE_KEYS
} from '@/lib/llm/settings/browserOSTypes'

// Type definitions for chrome.browserOS API
declare global {
  interface ChromeBrowserOS {
    getPref(name: string, callback: (pref: { value: any }) => void): void
    setPref(name: string, value: any, pageId?: string, callback?: (success: boolean) => void): void
    getAllPrefs(callback: (prefs: { key: string; value: any }[]) => void): void
  }

  interface Chrome {
    browserOS?: ChromeBrowserOS
  }
}

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

// Helper function to get chrome.browserOS API
const getBrowserOSAPI = (): ChromeBrowserOS | null => {
  return (chrome as any)?.browserOS || null
}

// Helper function to read providers from BrowserOS preferences
const readProvidersFromPrefs = (): Promise<BrowserOSProvidersConfig | null> => {
  return new Promise((resolve) => {
    const browserOS = getBrowserOSAPI()

    if (!browserOS?.getPref) {
      // Fallback to chrome.storage.local
      chrome.storage?.local?.get(BROWSEROS_PREFERENCE_KEYS.PROVIDERS, (result) => {
        try {
          const raw = result?.[BROWSEROS_PREFERENCE_KEYS.PROVIDERS]
          if (!raw) {
            resolve(null)
            return
          }
          const config = BrowserOSProvidersConfigSchema.parse(
            typeof raw === 'string' ? JSON.parse(raw) : raw
          )
          resolve(config)
        } catch (e) {
          console.error('Failed to parse providers from storage:', e)
          resolve(null)
        }
      })
      return
    }

    browserOS.getPref(BROWSEROS_PREFERENCE_KEYS.PROVIDERS, (pref) => {
      if (chrome.runtime.lastError) {
        console.error('Failed to read preference:', chrome.runtime.lastError.message)
        resolve(null)
        return
      }

      if (!pref?.value) {
        resolve(null)
        return
      }

      try {
        const config = BrowserOSProvidersConfigSchema.parse(JSON.parse(pref.value))
        resolve(config)
      } catch (error) {
        console.error('Failed to parse providers config:', error)
        resolve(null)
      }
    })
  })
}

// Helper function to write providers to BrowserOS preferences
const writeProvidersToPrefs = (config: BrowserOSProvidersConfig): Promise<boolean> => {
  return new Promise((resolve) => {
    const browserOS = getBrowserOSAPI()
    const configJson = JSON.stringify(config)

    if (!browserOS?.setPref) {
      // Fallback to chrome.storage.local
      chrome.storage?.local?.set(
        { [BROWSEROS_PREFERENCE_KEYS.PROVIDERS]: configJson },
        () => {
          if (chrome.runtime.lastError) {
            console.error('Failed to save to storage:', chrome.runtime.lastError.message)
            resolve(false)
          } else {
            resolve(true)
          }
        }
      )
      return
    }

    browserOS.setPref(
      BROWSEROS_PREFERENCE_KEYS.PROVIDERS,
      configJson,
      '',
      (success) => {
        if (chrome.runtime.lastError) {
          console.error('Failed to save preference:', chrome.runtime.lastError.message)
          resolve(false)
        } else {
          resolve(success)
        }
      }
    )
  })
}

// Default BrowserOS provider
const getDefaultBrowserOSProvider = (): BrowserOSProvider => ({
  id: 'browseros',
  name: 'BrowserOS',
  type: 'browseros',
  isDefault: true,
  isBuiltIn: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
})

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
        // Normalize isDefault flags
        const normalizedProviders = config.providers.map(p => ({
          ...p,
          isDefault: p.id === config.defaultProviderId
        }))

        set({
          providers: normalizedProviders,
          defaultProviderId: config.defaultProviderId,
          isLoading: false
        })
      } else {
        // No config found, use default
        const defaultProvider = getDefaultBrowserOSProvider()
        set({
          providers: [defaultProvider],
          defaultProviderId: defaultProvider.id,
          isLoading: false
        })
      }
    } catch (error) {
      console.error('Failed to load providers:', error)
      set({
        error: 'Failed to load providers',
        isLoading: false
      })

      // Fallback to default
      const defaultProvider = getDefaultBrowserOSProvider()
      set({
        providers: [defaultProvider],
        defaultProviderId: defaultProvider.id
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