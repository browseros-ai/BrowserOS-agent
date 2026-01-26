import type { UIMessage } from 'ai'
import type { FC } from 'react'
import { useMemo } from 'react'
import { useSessionInfo } from '@/lib/auth/sessionStorage'
import { useConversations } from '@/lib/conversations/conversationStorage'
import { GetProfileIdByUserIdDocument } from '@/lib/conversations/graphql/uploadConversationDocument'
import { useGraphqlQuery } from '@/lib/graphql/useGraphqlQuery'
import { useChatSessionContext } from '../layout/ChatSessionContext'
import { ConversationList } from './components/ConversationList'
import type { HistoryConversation } from './components/types'
import { extractLastUserMessage, groupConversations } from './components/utils'
import { GetConversationsForHistoryDocument } from './graphql/chatHistoryDocument'
import { LocalChatHistory } from './local/LocalChatHistory'

const RemoteChatHistory: FC<{ userId: string }> = ({ userId }) => {
  const { conversationId: activeConversationId } = useChatSessionContext()

  const { data: profileData } = useGraphqlQuery(GetProfileIdByUserIdDocument, {
    userId,
  })
  const profileId = profileData?.profileByUserId?.rowId

  const { data: graphqlData } = useGraphqlQuery(
    GetConversationsForHistoryDocument,
    { profileId: profileId! },
    { enabled: !!profileId },
  )

  const conversations = useMemo<HistoryConversation[]>(() => {
    if (!graphqlData?.conversations?.nodes) return []

    return graphqlData.conversations.nodes
      .filter((node): node is NonNullable<typeof node> => node !== null)
      .map((node) => {
        const messages = node.conversationMessages.nodes
          .filter((m): m is NonNullable<typeof m> => m !== null)
          .map((m) => m.message as UIMessage)

        return {
          id: node.rowId,
          lastMessagedAt: new Date(node.lastMessagedAt).getTime(),
          lastUserMessage: extractLastUserMessage(messages),
        }
      })
  }, [graphqlData])

  const groupedConversations = useMemo(
    () => groupConversations(conversations),
    [conversations],
  )

  return (
    <ConversationList
      groupedConversations={groupedConversations}
      activeConversationId={activeConversationId}
    />
  )
}

export const ChatHistory: FC = () => {
  const { sessionInfo } = useSessionInfo()
  const userId = sessionInfo.user?.id
  // needed to initiate remote-sync
  useConversations()

  if (userId) {
    return <RemoteChatHistory userId={userId} />
  }

  return <LocalChatHistory />
}
