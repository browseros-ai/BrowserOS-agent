import { useEffect, useState } from 'react'
import useSWR from 'swr'
import { getSearchSuggestions } from './getSearchSuggestions'
import type { SearchProviders } from './SearchProviders'

interface useSearchSuggestionsArgs {
  query: string
  searchEngine: SearchProviders
  debounceMs?: number
}

/**
 * @public
 */
export const useSearchSuggestions = ({
  query,
  searchEngine,
  debounceMs = 300,
}: useSearchSuggestionsArgs) => {
  const [debouncedQuery, setDebouncedQuery] = useState(query)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query)
    }, debounceMs)

    return () => clearTimeout(timer)
  }, [query, debounceMs])

  return useSWR(
    debouncedQuery ? [searchEngine, debouncedQuery] : null,
    getSearchSuggestions,
    { keepPreviousData: true },
  )
}
