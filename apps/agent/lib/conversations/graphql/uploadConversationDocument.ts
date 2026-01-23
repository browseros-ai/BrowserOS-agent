import { graphql } from '@/generated/graphql/gql'

export const CreateConversationForUploadDocument = graphql(`
  mutation CreateConversationForUpload($input: CreateConversationInput!) {
    createConversation(input: $input) {
      conversation {
        id
        rowId
        profileId
        lastMessagedAt
        createdAt
      }
    }
  }
`)

export const BulkCreateConversationMessagesDocument = graphql(`
  mutation BulkCreateConversationMessages($input: BulkCreateConversationMessagesInput!) {
    bulkCreateConversationMessages(input: $input) {
      result {
        id
        rowId
        conversationId
        orderIndex
      }
    }
  }
`)

export const ConversationExistsDocument = graphql(`
  query ConversationExists($pConversationId: String) {
    conversationExists(pConversationId: $pConversationId)
  }
`)
