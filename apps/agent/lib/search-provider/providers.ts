import type { SearchProviders } from '@/entrypoints/newtab/index/lib/searchSuggestions/SearchProviders'

export interface SearchProviderConfig {
  id: SearchProviders
  name: string
  searchUrl: string
  description: string
}

export const SEARCH_PROVIDERS: SearchProviderConfig[] = [
  {
    id: 'google',
    name: 'Google',
    searchUrl: 'https://www.google.com/search?q=',
    description: 'The most popular search engine worldwide',
  },
  {
    id: 'duckduckgo',
    name: 'DuckDuckGo',
    searchUrl: 'https://duckduckgo.com/?q=',
    description: 'Privacy-focused search with no tracking',
  },
  {
    id: 'bing',
    name: 'Bing',
    searchUrl: 'https://www.bing.com/search?q=',
    description: 'Microsoft search with AI-powered answers',
  },
  {
    id: 'brave',
    name: 'Brave Search',
    searchUrl: 'https://search.brave.com/search?q=',
    description: 'Independent search with its own index',
  },
  {
    id: 'yahoo',
    name: 'Yahoo',
    searchUrl: 'https://search.yahoo.com/search?p=',
    description: 'Classic search with news and web results',
  },
]

export function getProviderConfig(id: SearchProviders): SearchProviderConfig {
  return SEARCH_PROVIDERS.find((p) => p.id === id) ?? SEARCH_PROVIDERS[0]
}
