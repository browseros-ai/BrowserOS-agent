import { storage } from '@wxt-dev/storage'
import type { ChatAction } from '@/lib/chat-actions/types'

export type ChatOrigin = 'sidepanel' | 'newtab' | 'onboarding'

/**
 * @public
 */
export interface SearchActionStorage {
  query: string
  mode: 'chat' | 'agent'
  action?: ChatAction
  origin?: ChatOrigin
}

/**
 * @public
 */
export const searchActionsStorage = storage.defineItem<SearchActionStorage>(
  'local:search-actions',
)
