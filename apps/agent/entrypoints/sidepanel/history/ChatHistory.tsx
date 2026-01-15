import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import { MessageSquare, Trash2 } from 'lucide-react'
import { type FC, useMemo } from 'react'
import { Link } from 'react-router'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  type Conversation,
  useConversations,
} from '@/lib/conversations/conversationStorage'

dayjs.extend(relativeTime)

type TimeGroup = 'today' | 'thisWeek' | 'thisMonth' | 'older'

interface GroupedConversations {
  today: Conversation[]
  thisWeek: Conversation[]
  thisMonth: Conversation[]
  older: Conversation[]
}

const TIME_GROUP_LABELS: Record<TimeGroup, string> = {
  today: 'Today',
  thisWeek: 'This Week',
  thisMonth: 'This Month',
  older: 'Older',
}

const getTimeGroup = (timestamp: number): TimeGroup => {
  const date = dayjs(timestamp)
  const now = dayjs()

  if (date.isSame(now, 'day')) return 'today'
  if (date.isSame(now, 'week')) return 'thisWeek'
  if (date.isSame(now, 'month')) return 'thisMonth'
  return 'older'
}

const getLastUserMessage = (conversation: Conversation): string => {
  const userMessages = conversation.messages.filter((m) => m.role === 'user')
  const lastUserMessage = userMessages[userMessages.length - 1]

  if (!lastUserMessage) return 'New conversation'

  const textParts = lastUserMessage.parts.filter((p) => p.type === 'text')
  const text = textParts.map((p) => p.text).join(' ')

  return text || 'New conversation'
}

const ConversationItem: FC<{
  conversation: Conversation
  onDelete: (id: string) => void
}> = ({ conversation, onDelete }) => {
  const label = getLastUserMessage(conversation)
  const relativeTimeAgo = dayjs(conversation.lastMessagedAt).fromNow()

  return (
    <Link
      to={`/?conversationId=${conversation.id}`}
      className="group flex w-full items-start gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-muted/50"
    >
      <div className="mt-0.5 shrink-0 text-muted-foreground">
        <MessageSquare className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1 overflow-hidden">
        <p className="truncate font-medium text-foreground text-sm">{label}</p>
        <p className="text-muted-foreground text-xs">{relativeTimeAgo}</p>
      </div>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          onDelete(conversation.id)
        }}
        className="shrink-0 rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
        title="Delete conversation"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </Link>
  )
}

const ConversationGroup: FC<{
  label: string
  conversations: Conversation[]
  onDelete: (id: string) => void
}> = ({ label, conversations, onDelete }) => {
  if (conversations.length === 0) return null

  return (
    <div className="mb-4">
      <h3 className="mb-2 px-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">
        {label}
      </h3>
      <div className="space-y-1">
        {conversations.map((conversation) => (
          <ConversationItem
            key={conversation.id}
            conversation={conversation}
            onDelete={onDelete}
          />
        ))}
      </div>
    </div>
  )
}

export const ChatHistory: FC = () => {
  const { conversations, removeConversation } = useConversations()

  const groupedConversations = useMemo<GroupedConversations>(() => {
    const groups: GroupedConversations = {
      today: [],
      thisWeek: [],
      thisMonth: [],
      older: [],
    }

    for (const conversation of conversations) {
      const group = getTimeGroup(conversation.lastMessagedAt)
      groups[group].push(conversation)
    }

    return groups
  }, [conversations])

  const hasConversations = conversations.length > 0

  return (
    <ScrollArea className="h-full w-full overflow-hidden">
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
              onDelete={removeConversation}
            />
            <ConversationGroup
              label={TIME_GROUP_LABELS.thisWeek}
              conversations={groupedConversations.thisWeek}
              onDelete={removeConversation}
            />
            <ConversationGroup
              label={TIME_GROUP_LABELS.thisMonth}
              conversations={groupedConversations.thisMonth}
              onDelete={removeConversation}
            />
            <ConversationGroup
              label={TIME_GROUP_LABELS.older}
              conversations={groupedConversations.older}
              onDelete={removeConversation}
            />
          </>
        )}
      </div>
    </ScrollArea>
  )
}
