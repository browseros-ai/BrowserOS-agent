import { graphql } from '@/generated/graphql/gql'

export const GetConversationsForHistoryDocument = graphql(`
  query GetConversationsForHistory($profileId: String!, $first: Int = 50) {
    conversations(
      condition: { profileId: $profileId }
      first: $first
      orderBy: LAST_MESSAGED_AT_DESC
    ) {
      nodes {
        rowId
        lastMessagedAt
        conversationMessages(last: 5, orderBy: ORDER_INDEX_ASC) {
          nodes {
            message
          }
        }
      }
    }
  }
`)
