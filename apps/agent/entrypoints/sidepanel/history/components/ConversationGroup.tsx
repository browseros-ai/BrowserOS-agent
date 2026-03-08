import type { FC } from 'react'
import { cn } from '@/lib/utils'
import { ConversationItem } from './ConversationItem'
import type { HistoryConversation, HistoryListVariant } from './types'

interface ConversationGroupProps {
  label: string
  conversations: HistoryConversation[]
  onDelete?: (id: string) => void
  activeConversationId: string
  getConversationHref: (conversationId: string) => string
  onNavigate?: () => void
  variant?: HistoryListVariant
}

export const ConversationGroup: FC<ConversationGroupProps> = ({
  label,
  conversations,
  onDelete,
  activeConversationId,
  getConversationHref,
  onNavigate,
  variant = 'sidepanel',
}) => {
  if (conversations.length === 0) return null

  return (
    <div className={cn(variant === 'page' ? 'mb-6' : 'mb-4')}>
      <h3
        className={cn(
          'font-semibold text-muted-foreground uppercase tracking-wider',
          variant === 'page' ? 'mb-3 px-2 text-[11px]' : 'mb-2 px-3 text-xs',
        )}
      >
        {label}
      </h3>
      <div className="space-y-1">
        {conversations.map((conversation) => (
          <ConversationItem
            key={conversation.id}
            conversation={conversation}
            onDelete={onDelete}
            isActive={conversation.id === activeConversationId}
            href={getConversationHref(conversation.id)}
            onNavigate={onNavigate}
            variant={variant}
          />
        ))}
      </div>
    </div>
  )
}
