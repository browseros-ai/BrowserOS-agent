type FrontendCategory =
  | 'politics'
  | 'sports'
  | 'crypto'
  | 'economics'
  | 'entertainment'
  | 'science'
  | 'weather'
  | 'tech'

const CATEGORY_MAP: Record<string, FrontendCategory> = {
  Politics: 'politics',
  'US Politics': 'politics',
  World: 'politics',
  'World Politics': 'politics',
  Sports: 'sports',
  'Climate and Weather': 'weather',
  Climate: 'weather',
  Weather: 'weather',
  Economics: 'economics',
  Economy: 'economics',
  Financial: 'economics',
  Financials: 'economics',
  Finance: 'economics',
  Tech: 'tech',
  Technology: 'tech',
  AI: 'tech',
  Entertainment: 'entertainment',
  Culture: 'entertainment',
  Science: 'science',
  Crypto: 'crypto',
  Cryptocurrency: 'crypto',
}

// Map tags that hint at crypto markets
const CRYPTO_TAGS = [
  'bitcoin',
  'btc',
  'ethereum',
  'eth',
  'crypto',
  'defi',
  'solana',
]

export function mapCategory(
  kalshiCategory: string,
  tags: string[] = [],
  title = '',
): FrontendCategory {
  // Check tags for crypto signals first
  const lowerTags = tags.map((t) => t.toLowerCase())
  if (lowerTags.some((t) => CRYPTO_TAGS.includes(t))) return 'crypto'

  // Check title for crypto keywords
  const lowerTitle = title.toLowerCase()
  if (CRYPTO_TAGS.some((k) => lowerTitle.includes(k))) return 'crypto'

  // Direct category mapping
  const mapped = CATEGORY_MAP[kalshiCategory]
  if (mapped) return mapped

  // Case-insensitive fallback
  const lowerCategory = kalshiCategory.toLowerCase()
  for (const [key, value] of Object.entries(CATEGORY_MAP)) {
    if (key.toLowerCase() === lowerCategory) return value
  }

  return 'economics'
}
