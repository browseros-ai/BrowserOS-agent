import { storage } from '@wxt-dev/storage'
import type { UIMessage } from 'ai'

export interface SharedSidepanelConversation {
  messages: UIMessage[]
  updatedAt: number
}

export type SharedSidepanelConversationStore = Record<
  string,
  SharedSidepanelConversation
>

const EMPTY_SHARED_SIDEPANEL_CONVERSATIONS: SharedSidepanelConversationStore =
  {}

const sharedSidepanelConversationStorage =
  storage.defineItem<SharedSidepanelConversationStore>(
    'local:shared-sidepanel-conversations',
    {
      fallback: EMPTY_SHARED_SIDEPANEL_CONVERSATIONS,
    },
  )

function haveMessagesChanged(left: UIMessage[], right: UIMessage[]): boolean {
  return JSON.stringify(left) !== JSON.stringify(right)
}

export async function getSharedSidepanelConversation(
  conversationId: string,
): Promise<SharedSidepanelConversation | null> {
  const store = await sharedSidepanelConversationStorage.getValue()
  return store[conversationId] ?? null
}

export async function saveSharedSidepanelConversation(
  conversationId: string,
  messages: UIMessage[],
): Promise<void> {
  const store = await sharedSidepanelConversationStorage.getValue()
  const existing = store[conversationId]

  if (existing && !haveMessagesChanged(existing.messages, messages)) {
    return
  }

  await sharedSidepanelConversationStorage.setValue({
    ...store,
    [conversationId]: {
      messages,
      updatedAt: Date.now(),
    },
  })
}

export function watchSharedSidepanelConversations(
  callback: (store: SharedSidepanelConversationStore) => void,
): () => void {
  return sharedSidepanelConversationStorage.watch((store) => {
    callback(store ?? EMPTY_SHARED_SIDEPANEL_CONVERSATIONS)
  })
}
