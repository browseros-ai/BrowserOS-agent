import { getBrowserOSAdapter } from '@/lib/browseros/adapter'
import { BROWSEROS_PREFS } from '@/lib/browseros/prefs'
import { isKimiLaunchEnabled } from '@/lib/feature-flags/kimi-launch'

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

export const KIMI_LAUNCH_DEFAULT_PROVIDERS: LlmHubProvider[] = [
  { name: 'Kimi', url: 'https://www.kimi.com' },
  { name: 'ChatGPT', url: 'https://chatgpt.com' },
  { name: 'Claude', url: 'https://claude.ai' },
  { name: 'Gemini', url: 'https://gemini.google.com' },
]

async function getDefaultProviders(): Promise<LlmHubProvider[]> {
  const kimiEnabled = await isKimiLaunchEnabled()
  return kimiEnabled ? KIMI_LAUNCH_DEFAULT_PROVIDERS : DEFAULT_PROVIDERS
}

export async function loadProviders(): Promise<LlmHubProvider[]> {
  const defaults = await getDefaultProviders()
  try {
    const adapter = getBrowserOSAdapter()
    const providersPref = await adapter.getPref(
      BROWSEROS_PREFS.THIRD_PARTY_LLM_PROVIDERS,
    )
    const providers = (providersPref?.value as LlmHubProvider[]) || []

    if (providers.length === 0) {
      return defaults
    }

    return providers
  } catch {
    return defaults
  }
}

export async function saveProviders(
  providers: LlmHubProvider[],
): Promise<boolean> {
  try {
    const adapter = getBrowserOSAdapter()
    return await adapter.setPref(
      BROWSEROS_PREFS.THIRD_PARTY_LLM_PROVIDERS,
      providers,
    )
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
