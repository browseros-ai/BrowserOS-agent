import { storage } from '@wxt-dev/storage'
import type { UIMessage } from 'ai'
import { useEffect, useState } from 'react'

const MAX_CONVERSATIONS = 50

export interface Conversation {
  id: string
  messages: UIMessage[]
  lastMessagedAt: number
}

export const conversationStorage = storage.defineItem<Conversation[]>(
  'local:conversations',
  {
    fallback: [],
  },
)

export function useConversations() {
  const [conversations, setConversations] = useState<Conversation[]>([])

  useEffect(() => {
    conversationStorage.getValue().then(setConversations)
    const unwatch = conversationStorage.watch((newValue) => {
      setConversations(newValue ?? [])
    })
    return unwatch
  }, [])

  const addConversation = async (
    conversation: Omit<Conversation, 'id' | 'lastMessagedAt'>,
  ) => {
    const newConversation: Conversation = {
      id: crypto.randomUUID(),
      lastMessagedAt: Date.now(),
      ...conversation,
    }
    const current = (await conversationStorage.getValue()) ?? []
    const updated = [newConversation, ...current].slice(0, MAX_CONVERSATIONS)
    await conversationStorage.setValue(updated)
    return newConversation
  }

  const removeConversation = async (id: string) => {
    const current = (await conversationStorage.getValue()) ?? []
    await conversationStorage.setValue(current.filter((c) => c.id !== id))
  }

  const editConversation = async (
    id: string,
    updates: Partial<Omit<Conversation, 'id'>>,
  ) => {
    const current = (await conversationStorage.getValue()) ?? []
    await conversationStorage.setValue(
      current.map((c) => (c.id === id ? { ...c, ...updates } : c)),
    )
  }

  const updateMessages = async (id: string, messages: UIMessage[]) => {
    const current = (await conversationStorage.getValue()) ?? []
    await conversationStorage.setValue(
      current.map((c) =>
        c.id === id ? { ...c, messages, lastMessagedAt: Date.now() } : c,
      ),
    )
  }

  const getConversation = (id: string) => {
    return conversations.find((c) => c.id === id)
  }

  return {
    conversations,
    addConversation,
    removeConversation,
    editConversation,
    updateMessages,
    getConversation,
  }
}
