import { BrowserOSProvider, BrowserOSProvidersConfig } from './browserOSTypes'
import { LLMSettingsReader } from './LLMSettingsReader'

let cachedBrowserOSProvider: BrowserOSProvider | null = null
let cachedDefaultProvider: BrowserOSProvider | null = null

const cloneProvider = (provider: BrowserOSProvider | null): BrowserOSProvider | null => {
  if (!provider) return null
  return { ...provider }
}

const extractDefaultProvider = (config: BrowserOSProvidersConfig | null): BrowserOSProvider | null => {
  if (!config) return null
  const provider = config.providers.find(p => p.id === config.defaultProviderId) || config.providers[0] || null
  return provider ? { ...provider } : null
}

/**
 * Extract the BrowserOS provider specifically (where custom prompts are stored)
 */
const extractBrowserOSProvider = (config: BrowserOSProvidersConfig | null): BrowserOSProvider | null => {
  if (!config) return null
  // Look for the BrowserOS provider specifically (it has type 'browseros')
  const browserOSProvider = config.providers.find(p => p.type === 'browseros')
  return browserOSProvider ? { ...browserOSProvider } : null
}

const readDefaultProvider = async (): Promise<BrowserOSProvider | null> => {
  try {
    const config = await LLMSettingsReader.readAllProviders()
    return extractDefaultProvider(config)
  } catch (error) {
    console.warn('[customSystemPrompt] Failed to read providers config:', error)
    return null
  }
}

/**
 * Read the BrowserOS provider specifically (for custom system prompts)
 */
const readBrowserOSProvider = async (): Promise<BrowserOSProvider | null> => {
  try {
    const config = await LLMSettingsReader.readAllProviders()
    return extractBrowserOSProvider(config)
  } catch (error) {
    console.warn('[customSystemPrompt] Failed to read BrowserOS provider:', error)
    return null
  }
}

export const clearCustomSystemPromptCache = (): void => {
  cachedBrowserOSProvider = null
  cachedDefaultProvider = null
}

export const setCachedDefaultProvider = (provider: BrowserOSProvider | null): void => {
  cachedDefaultProvider = cloneProvider(provider)
  // If this is a BrowserOS provider, also cache it as the BrowserOS provider
  if (provider && provider.type === 'browseros') {
    cachedBrowserOSProvider = cloneProvider(provider)
  }
}

export const getCachedDefaultProvider = async (): Promise<BrowserOSProvider | null> => {
  if (cachedDefaultProvider) {
    return cachedDefaultProvider
  }
  const provider = await readDefaultProvider()
  cachedDefaultProvider = cloneProvider(provider)
  return cachedDefaultProvider
}

/**
 * Get the cached BrowserOS provider (where custom prompts are stored)
 */
const getCachedBrowserOSProvider = async (): Promise<BrowserOSProvider | null> => {
  if (cachedBrowserOSProvider) {
    return cachedBrowserOSProvider
  }
  const provider = await readBrowserOSProvider()
  cachedBrowserOSProvider = cloneProvider(provider)
  return cachedBrowserOSProvider
}

export const applyCustomSystemPrompt = async (basePrompt: string): Promise<string> => {
  try {
    // Always read custom prompt from the BrowserOS provider, regardless of which provider is currently active
    // Custom prompts are stored in the BrowserOS provider configuration even when using other providers
    const browserOSProvider = await getCachedBrowserOSProvider()
    if (!browserOSProvider) {
      // No BrowserOS provider found, just return the base prompt
      return basePrompt
    }

    const customPrompt = (browserOSProvider.systemPrompt ?? '').trim()
    if (!customPrompt) {
      return basePrompt
    }

    return `${customPrompt}\n\n${basePrompt}`
  } catch (error) {
    console.warn('[customSystemPrompt] Failed to apply custom prompt:', error)
    return basePrompt
  }
}
