import { getBrowserOSAdapter } from '@/lib/browseros/adapter'
import { BROWSEROS_PREFS } from '@/lib/browseros/prefs'

/** @public */
export interface LlmHubProvider {
  name: string
  url: string
}

export const DEFAULT_PROVIDERS: LlmHubProvider[] = [
  { name: 'Kimi', url: 'https://www.kimi.com' },
  { name: 'ChatGPT', url: 'https://chatgpt.com' },
  { name: 'Claude', url: 'https://claude.ai' },
  { name: 'Gemini', url: 'https://gemini.google.com' },
]

const LEGACY_DEFAULT_NAMES = new Set([
  'ChatGPT',
  'Claude',
  'Grok',
  'Gemini',
  'Perplexity',
])

function isLegacyDefaults(providers: LlmHubProvider[]): boolean {
  if (providers.length !== LEGACY_DEFAULT_NAMES.size) return false
  return providers.every((p) => LEGACY_DEFAULT_NAMES.has(p.name))
}

export async function loadProviders(): Promise<LlmHubProvider[]> {
  try {
    const adapter = getBrowserOSAdapter()
    const providersPref = await adapter.getPref(
      BROWSEROS_PREFS.THIRD_PARTY_LLM_PROVIDERS,
    )
    const providers = (providersPref?.value as LlmHubProvider[]) || []

    if (providers.length === 0 || isLegacyDefaults(providers)) {
      return DEFAULT_PROVIDERS
    }

    return providers
  } catch {
    return DEFAULT_PROVIDERS
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
