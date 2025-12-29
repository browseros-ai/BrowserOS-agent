import { useMemo } from 'react'
import { useAITabSuggestions } from '../aiTabSuggestions/useAITabSuggestions'
import { useBrowserOSSuggestions } from '../browserOSSuggestions/useBrowserOSSuggestions'
import { useSearchSuggestions } from '../searchSuggestions/useSearchSuggestions'
import type {
  AITabSuggestionItem,
  BrowserOSSuggestionItem,
  SearchSuggestionItem,
  SuggestionItem,
  SuggestionSection,
} from './types'

interface UseSuggestionsArgs {
  query: string
  selectedTabs: chrome.tabs.Tab[]
}

/**
 * @public
 */
export const useSuggestions = ({ query, selectedTabs }: UseSuggestionsArgs) => {
  const { data: searchResultsFromAPI } = useSearchSuggestions({
    query,
    searchEngine: 'google',
  })

  const searchResults: string[] = useMemo(() => {
    const results = [...(searchResultsFromAPI ?? [])]
    if (query && !results.includes(query)) {
      results.unshift(query)
    }
    return results
  }, [searchResultsFromAPI, query])

  const aiTabResults = useAITabSuggestions({ selectedTabs, input: query })
  const browserOSResults = useBrowserOSSuggestions({ query })

  const sections = useMemo(() => {
    const result: SuggestionSection[] = []

    if (query && browserOSResults.length > 0) {
      const browserOSItems: BrowserOSSuggestionItem[] = browserOSResults.map(
        (item, index) => ({
          id: `browseros-${index}`,
          type: 'browseros' as const,
          mode: item.mode,
          message: item.message,
        }),
      )
      result.push({
        id: 'browseros',
        // Removed title since browserOS result will only have 1 item
        title: '',
        items: browserOSItems,
      })
    }

    if (selectedTabs.length > 0 && aiTabResults.length > 0) {
      const aiItems: AITabSuggestionItem[] = aiTabResults.map(
        (item, index) => ({
          id: `ai-tab-${index}`,
          type: 'ai-tab' as const,
          name: item.name,
          icon: item.icon,
          description: item.description,
          minTabs: item.minTabs,
          maxTabs: item.maxTabs,
        }),
      )
      result.push({
        id: 'ai-actions',
        title: 'AI Actions',
        items: aiItems,
      })
    } else if (query && searchResults && searchResults.length > 0) {
      const searchItems: SearchSuggestionItem[] = searchResults.map(
        (item, index) => ({
          id: `search-${index}`,
          type: 'search' as const,
          query: item,
        }),
      )
      result.push({
        id: 'google-search',
        title: 'Google Search',
        items: searchItems,
      })
    }

    return result
  }, [
    query,
    browserOSResults,
    selectedTabs.length,
    aiTabResults,
    searchResults,
  ])

  const flatItems = useMemo(
    () => sections.flatMap((section) => section.items),
    [sections],
  )

  return { sections, flatItems }
}

/**
 * @public
 */
export const getSuggestionLabel = (item: SuggestionItem): string => {
  switch (item.type) {
    case 'search':
      return item.query
    case 'ai-tab':
      return item.name
    case 'browseros':
      return item.message
  }
}
