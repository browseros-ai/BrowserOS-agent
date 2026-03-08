import type { FC } from 'react'
import { useMemo } from 'react'
import { useConversations } from '@/lib/conversations/conversationStorage'
import { ConversationList } from '../components/ConversationList'
import type {
  HistoryConversation,
  HistoryListVariant,
} from '../components/types'
import { extractLastUserMessage, groupConversations } from '../components/utils'

interface LocalChatHistoryProps {
  activeConversationId: string
  getConversationHref: (conversationId: string) => string
  onNewConversation: () => void
  onNavigate?: () => void
  variant?: HistoryListVariant
}

export const LocalChatHistory: FC<LocalChatHistoryProps> = ({
  activeConversationId,
  getConversationHref,
  onNewConversation,
  onNavigate,
  variant = 'sidepanel',
}) => {
  const { conversations: localConversations, removeConversation } =
    useConversations()

  const conversations = useMemo<HistoryConversation[]>(() => {
    return localConversations.map((conv) => ({
      id: conv.id,
      lastMessagedAt: conv.lastMessagedAt,
      lastUserMessage: extractLastUserMessage(conv.messages),
    }))
  }, [localConversations])

  const groupedConversations = useMemo(
    () => groupConversations(conversations),
    [conversations],
  )

  return (
    <ConversationList
      groupedConversations={groupedConversations}
      activeConversationId={activeConversationId}
      onDelete={removeConversation}
      getConversationHref={getConversationHref}
      onNewConversation={onNewConversation}
      onNavigate={onNavigate}
      variant={variant}
    />
  )
}
