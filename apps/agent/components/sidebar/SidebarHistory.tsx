import { keepPreviousData } from '@tanstack/react-query'
import type { UIMessage } from 'ai'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import { Loader2, MessageSquare } from 'lucide-react'
import type { FC } from 'react'
import { useMemo } from 'react'
import { NavLink, useLocation } from 'react-router'
import {
  GetConversationsForHistoryDocument,
  DeleteConversationDocument,
} from '@/entrypoints/sidepanel/history/graphql/chatHistoryDocument'
import type { HistoryConversation } from '@/entrypoints/sidepanel/history/components/types'
import {
  extractLastUserMessage,
  groupConversations,
} from '@/entrypoints/sidepanel/history/components/utils'
import { useSessionInfo } from '@/lib/auth/sessionStorage'
import { useConversations } from '@/lib/conversations/conversationStorage'
import { GetProfileIdByUserIdDocument } from '@/lib/conversations/graphql/uploadConversationDocument'
import { useGraphqlInfiniteQuery } from '@/lib/graphql/useGraphqlInfiniteQuery'
import { useGraphqlQuery } from '@/lib/graphql/useGraphqlQuery'
import { cn } from '@/lib/utils'
import { ScrollArea } from '@/components/ui/scroll-area'

dayjs.extend(relativeTime)

interface SidebarHistoryItemProps {
  conversation: HistoryConversation
  expanded: boolean
}

const SidebarHistoryItem: FC<SidebarHistoryItemProps> = ({
  conversation,
  expanded,
}) => {
  const location = useLocation()
  const searchParams = new URLSearchParams(location.search)
  const activeConversationId = searchParams.get('conversationId')
  const isActive = conversation.id === activeConversationId

  return (
    <NavLink
      to={`/home?conversationId=${conversation.id}`}
      className={cn(
        'flex h-8 items-center gap-2 overflow-hidden whitespace-nowrap rounded-md px-3 text-sm transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
        isActive && 'bg-sidebar-accent text-sidebar-accent-foreground',
      )}
    >
      <MessageSquare className="size-3.5 shrink-0 text-muted-foreground" />
      <span
        className={cn(
          'truncate text-muted-foreground transition-opacity duration-200',
          expanded ? 'opacity-100' : 'opacity-0',
          isActive && 'text-sidebar-accent-foreground',
        )}
      >
        {conversation.lastUserMessage}
      </span>
    </NavLink>
  )
}

const RemoteSidebarHistory: FC<{ userId: string; expanded: boolean }> = ({
  userId,
  expanded,
}) => {
  const { data: profileData } = useGraphqlQuery(GetProfileIdByUserIdDocument, {
    userId,
  })
  const profileId = profileData?.profileByUserId?.rowId

  const { data: graphqlData, isLoading } = useGraphqlInfiniteQuery(
    GetConversationsForHistoryDocument,
    // biome-ignore lint/style/noNonNullAssertion: guarded by enabled
    (cursor) => ({ profileId: profileId!, after: cursor, first: 20 }),
    {
      enabled: !!profileId,
      initialPageParam: undefined,
      getNextPageParam: (lastPage) =>
        lastPage.conversations?.pageInfo.hasNextPage
          ? lastPage.conversations.pageInfo.endCursor
          : undefined,
      placeholderData: keepPreviousData,
    },
  )

  const conversations = useMemo<HistoryConversation[]>(() => {
    if (!graphqlData?.pages) return []

    return graphqlData.pages.flatMap((page) =>
      (page.conversations?.nodes ?? [])
        .filter((node): node is NonNullable<typeof node> => node !== null)
        .map((node) => {
          const messages = node.conversationMessages.nodes
            .filter((m): m is NonNullable<typeof m> => m !== null)
            .map((m) => m.message as UIMessage)

          const timestamp = node.lastMessagedAt.endsWith('Z')
            ? node.lastMessagedAt
            : `${node.lastMessagedAt}Z`

          return {
            id: node.rowId,
            lastMessagedAt: new Date(timestamp).getTime(),
            lastUserMessage: extractLastUserMessage(messages),
          }
        }),
    )
  }, [graphqlData])

  if (!profileId || isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return <HistoryList conversations={conversations} expanded={expanded} />
}

const LocalSidebarHistory: FC<{ expanded: boolean }> = ({ expanded }) => {
  const { conversations: localConversations } = useConversations()

  const conversations = useMemo<HistoryConversation[]>(
    () =>
      localConversations.map((conv) => ({
        id: conv.id,
        lastMessagedAt: conv.lastMessagedAt,
        lastUserMessage: extractLastUserMessage(conv.messages),
      })),
    [localConversations],
  )

  return <HistoryList conversations={conversations} expanded={expanded} />
}

const HistoryList: FC<{
  conversations: HistoryConversation[]
  expanded: boolean
}> = ({ conversations, expanded }) => {
  if (conversations.length === 0) {
    return null
  }

  const grouped = groupConversations(conversations)
  const allSorted = [
    ...grouped.today,
    ...grouped.thisWeek,
    ...grouped.thisMonth,
    ...grouped.older,
  ]

  return (
    <div className="space-y-0.5">
      {allSorted.map((conversation) => (
        <SidebarHistoryItem
          key={conversation.id}
          conversation={conversation}
          expanded={expanded}
        />
      ))}
    </div>
  )
}

interface SidebarHistoryProps {
  expanded: boolean
}

export const SidebarHistory: FC<SidebarHistoryProps> = ({ expanded }) => {
  const { sessionInfo } = useSessionInfo()
  const userId = sessionInfo.user?.id
  useConversations()

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {expanded && (
        <h3 className="mb-1 px-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">
          Recent
        </h3>
      )}
      <ScrollArea className="flex-1">
        <div className="space-y-0.5">
          {userId ? (
            <RemoteSidebarHistory userId={userId} expanded={expanded} />
          ) : (
            <LocalSidebarHistory expanded={expanded} />
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
