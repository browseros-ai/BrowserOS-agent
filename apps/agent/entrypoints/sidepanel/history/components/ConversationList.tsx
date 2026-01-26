import { MessageSquare } from 'lucide-react'
import type { FC } from 'react'
import { Link } from 'react-router'
import { ConversationGroup } from './ConversationGroup'
import type { GroupedConversations } from './types'
import { TIME_GROUP_LABELS } from './utils'

interface ConversationListProps {
  groupedConversations: GroupedConversations
  activeConversationId: string
  onDelete?: (id: string) => void
}

export const ConversationList: FC<ConversationListProps> = ({
  groupedConversations,
  activeConversationId,
  onDelete,
}) => {
  const hasConversations =
    groupedConversations.today.length > 0 ||
    groupedConversations.thisWeek.length > 0 ||
    groupedConversations.thisMonth.length > 0 ||
    groupedConversations.older.length > 0

  return (
    <main className="mt-4 flex h-full flex-1 flex-col space-y-4 overflow-y-auto">
      <div className="w-full p-3">
        {!hasConversations ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <MessageSquare className="mb-3 h-10 w-10 text-muted-foreground/50" />
            <p className="text-muted-foreground text-sm">
              No conversations yet
            </p>
            <Link to="/" className="mt-2 text-primary text-sm hover:underline">
              Start a new chat
            </Link>
          </div>
        ) : (
          <>
            <ConversationGroup
              label={TIME_GROUP_LABELS.today}
              conversations={groupedConversations.today}
              onDelete={onDelete}
              activeConversationId={activeConversationId}
            />
            <ConversationGroup
              label={TIME_GROUP_LABELS.thisWeek}
              conversations={groupedConversations.thisWeek}
              onDelete={onDelete}
              activeConversationId={activeConversationId}
            />
            <ConversationGroup
              label={TIME_GROUP_LABELS.thisMonth}
              conversations={groupedConversations.thisMonth}
              onDelete={onDelete}
              activeConversationId={activeConversationId}
            />
            <ConversationGroup
              label={TIME_GROUP_LABELS.older}
              conversations={groupedConversations.older}
              onDelete={onDelete}
              activeConversationId={activeConversationId}
            />
          </>
        )}
      </div>
    </main>
  )
}
