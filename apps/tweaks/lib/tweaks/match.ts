export function normalizeDomain(input: string): string | null {
  const trimmed = input.trim().toLowerCase()
  if (!trimmed) return null

  const withoutProtocol = trimmed.replace(/^[a-z]+:\/\//, '')
  const withoutPath = withoutProtocol.split('/')[0] ?? withoutProtocol
  const withoutWildcardProtocol = withoutPath.replace(/^\*\./, '*.')
  const cleaned = withoutWildcardProtocol.replace(/:\d+$/, '')

  if (!cleaned || cleaned === '*') return null
  return cleaned
}

export function parseDomains(text: string): string[] {
  const tokens = text.split(/[\n,]/)
  const seen = new Set<string>()

  for (const token of tokens) {
    const normalized = normalizeDomain(token)
    if (normalized) {
      seen.add(normalized)
    }
  }

  return [...seen]
}

export function formatDomains(domains: string[]): string {
  return domains.join(', ')
}

export function domainMatchesHostname(
  domain: string,
  hostname: string,
): boolean {
  const normalizedDomain = normalizeDomain(domain)
  const normalizedHost = hostname.toLowerCase()

  if (!normalizedDomain) return false

  if (normalizedDomain.startsWith('*.')) {
    const base = normalizedDomain.slice(2)
    return normalizedHost === base || normalizedHost.endsWith(`.${base}`)
  }

  return (
    normalizedHost === normalizedDomain ||
    normalizedHost.endsWith(`.${normalizedDomain}`)
  )
}

export function tweakMatchesUrl(
  domains: string[],
  urlOrHostname: string,
): boolean {
  const hostname = urlOrHostname.includes('://')
    ? new URL(urlOrHostname).hostname
    : urlOrHostname

  return domains.some((domain) => domainMatchesHostname(domain, hostname))
}
