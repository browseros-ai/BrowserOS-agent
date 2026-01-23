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

export const CheckConversationExistsDocument = graphql(`
  query CheckConversationExists($rowId: String!) {
    conversation(rowId: $rowId) {
      rowId
    }
  }
`)
