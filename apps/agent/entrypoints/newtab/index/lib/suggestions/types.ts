import type { LucideIcon } from 'lucide-react'

/**
 * @public
 */
export type SuggestionType = 'search' | 'ai-tab' | 'browseros'

/**
 * @public
 */
interface BaseSuggestionItem {
  id: string
}

/**
 * @public
 */
export interface SearchSuggestionItem extends BaseSuggestionItem {
  type: 'search'
  query: string
}

/**
 * @public
 */
export interface AITabSuggestionItem extends BaseSuggestionItem {
  type: 'ai-tab'
  name: string
  icon: LucideIcon
  description: string
  minTabs: number
  maxTabs: number
}

/**
 * @public
 */
export interface BrowserOSSuggestionItem extends BaseSuggestionItem {
  type: 'browseros'
  mode: 'chat' | 'agent'
  message: string
}

/**
 * @public
 */
export type SuggestionItem =
  | SearchSuggestionItem
  | AITabSuggestionItem
  | BrowserOSSuggestionItem

/**
 * @public
 */
export interface SuggestionSection<T extends SuggestionItem = SuggestionItem> {
  id: string
  title: string
  items: T[]
}
