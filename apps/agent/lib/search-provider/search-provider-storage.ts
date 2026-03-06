import { storage } from '@wxt-dev/storage'
import { useCallback, useEffect, useState } from 'react'
import type { SearchProviders } from '@/entrypoints/newtab/index/lib/searchSuggestions/SearchProviders'

const DEFAULT_PROVIDER: SearchProviders = 'google'

export const searchProviderStorage = storage.defineItem<SearchProviders>(
  'local:search-provider',
  { fallback: DEFAULT_PROVIDER },
)

export function useSearchProvider() {
  const [provider, setProviderState] =
    useState<SearchProviders>(DEFAULT_PROVIDER)

  useEffect(() => {
    searchProviderStorage.getValue().then((value) => {
      setProviderState(value ?? DEFAULT_PROVIDER)
    })
    const unwatch = searchProviderStorage.watch((newValue) => {
      setProviderState(newValue ?? DEFAULT_PROVIDER)
    })
    return unwatch
  }, [])

  const setProvider = useCallback(async (value: SearchProviders) => {
    await searchProviderStorage.setValue(value)
    setProviderState(value)
  }, [])

  return { provider, setProvider }
}
