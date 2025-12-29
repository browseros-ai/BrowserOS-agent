import { getBrowserOSAdapter } from '@/lib/browseros/adapter'
import { BROWSEROS_PREFS } from '@/lib/browseros/prefs'

/** @public */
export interface LlmHubProvider {
  name: string
  url: string
}

export const DEFAULT_PROVIDERS: LlmHubProvider[] = [
  { name: 'ChatGPT', url: 'https://chatgpt.com' },
  { name: 'Claude', url: 'https://claude.ai' },
  { name: 'Grok', url: 'https://grok.com' },
  { name: 'Gemini', url: 'https://gemini.google.com' },
  { name: 'Perplexity', url: 'https://www.perplexity.ai' },
]

export async function loadProviders(): Promise<{
  providers: LlmHubProvider[]
  selectedIndex: number
}> {
  try {
    const adapter = getBrowserOSAdapter()

    const [providersPref, selectedPref] = await Promise.all([
      adapter.getPref(BROWSEROS_PREFS.THIRD_PARTY_LLM_PROVIDERS),
      adapter.getPref(BROWSEROS_PREFS.THIRD_PARTY_LLM_SELECTED),
    ])

    const providers = (providersPref?.value as LlmHubProvider[]) || []
    const selectedIndex = (selectedPref?.value as number) || 0

    if (providers.length === 0) {
      return { providers: DEFAULT_PROVIDERS, selectedIndex: 0 }
    }

    return { providers, selectedIndex }
  } catch {
    return { providers: DEFAULT_PROVIDERS, selectedIndex: 0 }
  }
}

export async function saveProviders(
  providers: LlmHubProvider[],
  selectedIndex: number,
): Promise<boolean> {
  try {
    const adapter = getBrowserOSAdapter()

    const [providersSuccess, selectedSuccess] = await Promise.all([
      adapter.setPref(BROWSEROS_PREFS.THIRD_PARTY_LLM_PROVIDERS, providers),
      adapter.setPref(BROWSEROS_PREFS.THIRD_PARTY_LLM_SELECTED, selectedIndex),
    ])

    return providersSuccess && selectedSuccess
  } catch {
    return false
  }
}

export function getFaviconUrl(url: string, size = 128): string | undefined {
  try {
    const normalized = url.trim()
    if (!normalized) return undefined
    const parsed = new URL(
      normalized.match(/^[a-zA-Z][a-zA-Z0-9+.-]*:/)
        ? normalized
        : `https://${normalized}`,
    )
    return `https://www.google.com/s2/favicons?domain=${parsed.hostname}&sz=${size}`
  } catch {
    return undefined
  }
}
