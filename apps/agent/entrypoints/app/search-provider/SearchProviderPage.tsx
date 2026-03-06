import type { FC } from 'react'
import { toast } from 'sonner'
import { SEARCH_PROVIDER_CHANGED_EVENT } from '@/lib/constants/analyticsEvents'
import { track } from '@/lib/metrics/track'
import type { SearchProviderConfig } from '@/lib/search-provider/providers'
import { getProviderConfig } from '@/lib/search-provider/providers'
import { useSearchProvider } from '@/lib/search-provider/search-provider-storage'
import { SearchProviderGrid } from './SearchProviderGrid'
import { SearchProviderHeader } from './SearchProviderHeader'

export const SearchProviderPage: FC = () => {
  const { provider, setProvider } = useSearchProvider()
  const activeConfig = getProviderConfig(provider)

  const handleSelectProvider = async (selected: SearchProviderConfig) => {
    if (selected.id === provider) return

    await setProvider(selected.id)
    track(SEARCH_PROVIDER_CHANGED_EVENT, {
      provider: selected.id,
      previous_provider: provider,
    })
    toast.success(`Search provider changed to ${selected.name}`)
  }

  return (
    <div className="fade-in slide-in-from-bottom-5 animate-in space-y-6 duration-500">
      <SearchProviderHeader activeProvider={activeConfig} />
      <SearchProviderGrid
        selectedProvider={provider}
        onSelectProvider={handleSelectProvider}
      />
    </div>
  )
}
