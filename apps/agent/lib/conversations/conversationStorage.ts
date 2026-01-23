import { storage } from '@wxt-dev/storage'
import type { UIMessage } from 'ai'
import { useEffect, useState } from 'react'
import { useSessionInfo } from '../auth/sessionStorage'
import { uploadConversationsToGraphql } from './uploadConversationsToGraphql'

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

  const { sessionInfo } = useSessionInfo()

  useEffect(() => {
    // user is logged in, could sync conversations from server here
    if (sessionInfo.user?.id && conversations.length > 0) {
      uploadConversationsToGraphql(conversations, setConversations)
    }
  }, [sessionInfo.user?.id, conversations])

  useEffect(() => {
    conversationStorage.getValue().then(setConversations)
    const unwatch = conversationStorage.watch((newValue) => {
      setConversations(newValue ?? [])
    })
    return unwatch
  }, [])

  const removeConversation = async (id: string) => {
    const current = (await conversationStorage.getValue()) ?? []
    await conversationStorage.setValue(current.filter((c) => c.id !== id))
  }

  const saveConversation = async (id: string, messages: UIMessage[]) => {
    const current = (await conversationStorage.getValue()) ?? []
    const existingIndex = current.findIndex((c) => c.id === id)

    if (existingIndex >= 0) {
      const existing = current[existingIndex]
      const hasContentChanged =
        existing.messages.length !== messages.length ||
        JSON.stringify(existing.messages) !== JSON.stringify(messages)

      if (!hasContentChanged) return

      current[existingIndex] = {
        ...existing,
        messages,
        lastMessagedAt: Date.now(),
      }
      await conversationStorage.setValue(current)
    } else {
      const newConversation: Conversation = {
        id,
        messages,
        lastMessagedAt: Date.now(),
      }
      let updated = [newConversation, ...current]
      if (updated.length > MAX_CONVERSATIONS) {
        updated = updated.slice(0, MAX_CONVERSATIONS)
      }
      await conversationStorage.setValue(updated)
    }
  }

  const getConversation = (id: string) => {
    return conversations.find((c) => c.id === id)
  }

  return {
    conversations,
    removeConversation,
    saveConversation,
    getConversation,
  }
}
