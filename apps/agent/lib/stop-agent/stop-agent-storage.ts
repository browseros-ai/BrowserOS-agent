import { storage } from '@wxt-dev/storage'

/**
 * @public
 */
export interface StopAgentStorage {
  conversationId: string
  timestamp: number
}

/**
 * @public
 */
export const stopAgentStorage =
  storage.defineItem<StopAgentStorage>('local:stop-agent')
