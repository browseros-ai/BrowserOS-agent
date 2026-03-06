import type { FC } from 'react'
import type { SearchProviders } from '@/entrypoints/newtab/index/lib/searchSuggestions/SearchProviders'
import type { SearchProviderConfig } from '@/lib/search-provider/providers'
import { SEARCH_PROVIDERS } from '@/lib/search-provider/providers'
import { SearchProviderCard } from './SearchProviderCard'

interface SearchProviderGridProps {
  selectedProvider: SearchProviders
  onSelectProvider: (provider: SearchProviderConfig) => void
}

export const SearchProviderGrid: FC<SearchProviderGridProps> = ({
  selectedProvider,
  onSelectProvider,
}) => {
  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm transition-all hover:shadow-md">
      <h3 className="mb-4 font-semibold text-lg">Available Search Engines</h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {SEARCH_PROVIDERS.map((provider) => (
          <SearchProviderCard
            key={provider.id}
            provider={provider}
            isSelected={provider.id === selectedProvider}
            onSelect={onSelectProvider}
          />
        ))}
      </div>
    </div>
  )
}
