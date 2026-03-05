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

const LEGACY_DEFAULTS_MAP = new Map([
  ['ChatGPT', 'https://chatgpt.com'],
  ['Claude', 'https://claude.ai'],
  ['Grok', 'https://grok.com'],
  ['Gemini', 'https://gemini.google.com'],
  ['Perplexity', 'https://www.perplexity.ai'],
])

function isLegacyDefaults(providers: LlmHubProvider[]): boolean {
  if (providers.length !== LEGACY_DEFAULTS_MAP.size) return false
  return providers.every((p) => LEGACY_DEFAULTS_MAP.get(p.name) === p.url)
}

async function migrateToDefaultProviders(): Promise<LlmHubProvider[]> {
  const defaults = DEFAULT_PROVIDERS.map((provider) => ({ ...provider }))
  try {
    const adapter = getBrowserOSAdapter()
    await adapter.setPref(BROWSEROS_PREFS.THIRD_PARTY_LLM_PROVIDERS, defaults)
  } catch {
    // Best effort migration: still return defaults for UI consistency
  }
  return defaults
}

export async function loadProviders(): Promise<LlmHubProvider[]> {
  try {
    const adapter = getBrowserOSAdapter()
    const providersPref = await adapter.getPref(
      BROWSEROS_PREFS.THIRD_PARTY_LLM_PROVIDERS,
    )
    const providers = (providersPref?.value as LlmHubProvider[]) || []

    if (providers.length === 0 || isLegacyDefaults(providers)) {
      return await migrateToDefaultProviders()
    }

    return providers
  } catch {
    return DEFAULT_PROVIDERS.map((provider) => ({ ...provider }))
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
