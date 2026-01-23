import { execute } from '@/lib/graphql/execute'
import { sessionStorage } from '../auth/sessionStorage'
import { sentry } from '../sentry/sentry'
import type { Conversation } from './conversationStorage'
import { conversationStorage } from './conversationStorage'
import {
  BulkCreateConversationMessagesDocument,
  ConversationExistsDocument,
  CreateConversationForUploadDocument,
} from './graphql/uploadConversationDocument'

export async function uploadConversationsToGraphql(
  conversations: Conversation[],
  setConversations: (conversations: Conversation[]) => void,
) {
  console.log(conversations.length)
  if (conversations.length === 0) return

  const sessionInfo = await sessionStorage.getValue()
  const profileId = sessionInfo?.user?.id

  console.log('Uploading conversations to GraphQL for profileId:', profileId)
  if (!profileId) return

  const uploadedIds: string[] = []

  for (const conversation of conversations) {
    try {
      console.log('running...')

      const existsResult = await execute(ConversationExistsDocument, {
        pConversationId: conversation.id,
      })

      console.log(existsResult)

      if (existsResult.conversationExists) {
        uploadedIds.push(conversation.id)
        continue
      }

      console.log('uploading conversation...')
      await execute(CreateConversationForUploadDocument, {
        input: {
          conversation: {
            rowId: conversation.id,
            profileId,
            lastMessagedAt: new Date(conversation.lastMessagedAt).toISOString(),
            createdAt: new Date(conversation.lastMessagedAt).toISOString(),
          },
        },
      })

      if (conversation.messages.length > 0) {
        await execute(BulkCreateConversationMessagesDocument, {
          input: {
            pConversationId: conversation.id,
            pMessages: conversation.messages.map((msg, index) => ({
              orderIndex: index,
              message: msg,
            })),
          },
        })
      }

      uploadedIds.push(conversation.id)
    } catch (error) {
      sentry.captureException(error, {
        extra: {
          message: `Failed to upload conversation: ${conversation.id}`,
        },
      })
      throw error
    }
  }

  // if (uploadedIds.length > 0) {
  //   const remaining = conversations.filter((c) => !uploadedIds.includes(c.id))
  //   await conversationStorage.setValue(remaining)
  //   setConversations(remaining)
  // }
}
