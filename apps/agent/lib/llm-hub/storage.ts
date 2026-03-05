import { getBrowserOSAdapter } from '@/lib/browseros/adapter'
import { BROWSEROS_PREFS } from '@/lib/browseros/prefs'

/** @public */
export interface LlmHubProvider {
  name: string
  url: string
}

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

async function clearLegacyDefaults(): Promise<void> {
  try {
    const adapter = getBrowserOSAdapter()
    await adapter.setPref(BROWSEROS_PREFS.THIRD_PARTY_LLM_PROVIDERS, [])
  } catch {
    // best effort
  }
}

export async function loadProviders(): Promise<LlmHubProvider[]> {
  try {
    const adapter = getBrowserOSAdapter()
    const providersPref = await adapter.getPref(
      BROWSEROS_PREFS.THIRD_PARTY_LLM_PROVIDERS,
    )
    const providers = (providersPref?.value as LlmHubProvider[]) || []

    if (isLegacyDefaults(providers)) {
      await clearLegacyDefaults()
      return []
    }

    return providers
  } catch {
    return []
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
