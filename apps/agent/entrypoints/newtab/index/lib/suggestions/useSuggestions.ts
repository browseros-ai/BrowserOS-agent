import { useMemo } from 'react'
import { SEARCH_TARGETS } from './searchTargets'
import type {
  SearchSuggestionItem,
  SuggestionItem,
  SuggestionSection,
} from './types'

interface UseSuggestionsArgs {
  query: string
}

/**
 * @public
 */
export const useSuggestions = ({ query }: UseSuggestionsArgs) => {
  const sections = useMemo(() => {
    const result: SuggestionSection[] = []

    if (!query) return result

    const searchItems: SearchSuggestionItem[] = []
    const llmItems: SearchSuggestionItem[] = []

    SEARCH_TARGETS.forEach((target) => {
      const item: SearchSuggestionItem = {
        id: `search-${target.id}`,
        type: 'search',
        query,
        url: target.buildUrl(query),
        engine: {
          id: target.id,
          label: target.label,
          kind: target.kind,
          iconUrl: target.iconUrl,
        },
      }
      if (target.kind === 'search') {
        searchItems.push(item)
      } else {
        llmItems.push(item)
      }
    })

    if (searchItems.length > 0) {
      result.push({
        id: 'search-engines',
        title: 'Search Engines',
        items: searchItems,
      })
    }

    if (llmItems.length > 0) {
      result.push({
        id: 'llm-providers',
        title: 'AI Providers',
        items: llmItems,
      })
    }

    return result
  }, [query])

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
