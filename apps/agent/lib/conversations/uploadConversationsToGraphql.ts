import { execute } from '@/lib/graphql/execute'
import { sessionStorage } from '../auth/sessionStorage'
import { sentry } from '../sentry/sentry'
import type { Conversation } from './conversationStorage'
import {
  BulkCreateConversationMessagesDocument,
  ConversationExistsDocument,
  CreateConversationForUploadDocument,
  GetProfileIdByUserIdDocument,
} from './graphql/uploadConversationDocument'

export async function uploadConversationsToGraphql(
  conversations: Conversation[],
  _setConversations: (conversations: Conversation[]) => void,
) {
  if (conversations.length === 0) return

  const sessionInfo = await sessionStorage.getValue()
  const userId = sessionInfo?.user?.id
  if (!userId) return

  const profileResult = await execute(GetProfileIdByUserIdDocument, { userId })
  const profileId = profileResult.profileByUserId?.rowId
  if (!profileId) return

  const uploadedIds: string[] = []

  for (const conversation of conversations) {
    try {
      const existsResult = await execute(ConversationExistsDocument, {
        pConversationId: conversation.id,
      })

      if (existsResult.conversationExists) {
        uploadedIds.push(conversation.id)
        continue
      }
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
        const BATCH_SIZE = 50
        for (let i = 0; i < conversation.messages.length; i += BATCH_SIZE) {
          const batch = conversation.messages.slice(i, i + BATCH_SIZE)
          await execute(BulkCreateConversationMessagesDocument, {
            input: {
              pConversationId: conversation.id,
              pMessages: batch.map((msg, batchIndex) => ({
                orderIndex: i + batchIndex,
                message: msg,
              })),
            },
          })
        }
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
