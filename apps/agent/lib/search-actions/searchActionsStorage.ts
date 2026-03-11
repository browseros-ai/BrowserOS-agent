import { storage } from '@wxt-dev/storage'
import type { ChatAction } from '@/lib/chat-actions/types'

export type SearchActionTarget = 'sidepanel' | 'newtab'

/**
 * @public
 */
export interface SearchActionStorage {
  query: string
  mode: 'chat' | 'agent'
  action?: ChatAction
  target?: SearchActionTarget
  targetTabId?: number
}

export function isSearchActionForTarget(
  searchAction: SearchActionStorage | null | undefined,
  target: SearchActionTarget,
  tabId?: number,
) {
  if (!searchAction) return false
  if (!searchAction.target && target !== 'sidepanel') return false
  if (searchAction.target && searchAction.target !== target) return false
  if (searchAction.targetTabId === undefined) return true
  return tabId !== undefined && searchAction.targetTabId === tabId
}

export function getSearchActionFingerprint(searchAction: SearchActionStorage) {
  return JSON.stringify({
    ...searchAction,
    target: searchAction.target ?? 'sidepanel',
    targetTabId: searchAction.targetTabId ?? null,
  })
}

/**
 * @public
 */
export const searchActionsStorage = storage.defineItem<SearchActionStorage>(
  'local:search-actions',
)
