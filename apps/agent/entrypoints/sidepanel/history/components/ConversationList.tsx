import { Loader2, MessageSquare } from 'lucide-react'
import { type FC, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ConversationGroup } from './ConversationGroup'
import type { GroupedConversations, HistoryListVariant } from './types'
import { TIME_GROUP_LABELS } from './utils'

interface ConversationListProps {
  groupedConversations: GroupedConversations
  activeConversationId: string
  onDelete?: (id: string) => void
  hasNextPage?: boolean
  isFetchingNextPage?: boolean
  onLoadMore?: () => void
  getConversationHref: (conversationId: string) => string
  onNewConversation: () => void
  onNavigate?: () => void
  variant?: HistoryListVariant
}

export const ConversationList: FC<ConversationListProps> = ({
  groupedConversations,
  activeConversationId,
  onDelete,
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
  getConversationHref,
  onNewConversation,
  onNavigate,
  variant = 'sidepanel',
}) => {
  const loadMoreRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!hasNextPage || !onLoadMore) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isFetchingNextPage) {
          onLoadMore()
        }
      },
      { threshold: 0.1 },
    )

    const currentRef = loadMoreRef.current
    if (currentRef) {
      observer.observe(currentRef)
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef)
      }
    }
  }, [hasNextPage, isFetchingNextPage, onLoadMore])

  const hasConversations =
    groupedConversations.today.length > 0 ||
    groupedConversations.thisWeek.length > 0 ||
    groupedConversations.thisMonth.length > 0 ||
    groupedConversations.older.length > 0

  return (
    <main
      className={cn(
        'flex min-h-0 flex-1 flex-col',
        variant === 'page'
          ? 'h-full overflow-hidden'
          : 'mt-4 h-full overflow-y-auto',
      )}
    >
      <div
        className={cn(
          'w-full',
          variant === 'page'
            ? 'styled-scrollbar flex-1 overflow-y-auto px-3 pb-4'
            : 'p-3',
        )}
      >
        {!hasConversations ? (
          <div
            className={cn(
              'flex flex-col items-center justify-center py-12 text-center',
              variant === 'page' &&
                'rounded-2xl border border-border/80 border-dashed bg-muted/20 px-6',
            )}
          >
            <MessageSquare
              className={cn(
                'mb-3 text-muted-foreground/50',
                variant === 'page' ? 'h-11 w-11' : 'h-10 w-10',
              )}
            />
            <p className="text-muted-foreground text-sm">
              No conversations yet
            </p>
            <Button
              variant={variant === 'page' ? 'default' : 'link'}
              size={variant === 'page' ? 'sm' : 'default'}
              onClick={onNewConversation}
              className={cn(
                'mt-3',
                variant === 'page' &&
                  'rounded-xl bg-primary px-4 text-primary-foreground shadow-sm hover:bg-primary/90',
              )}
            >
              Start a new chat
            </Button>
          </div>
        ) : (
          <>
            <ConversationGroup
              label={TIME_GROUP_LABELS.today}
              conversations={groupedConversations.today}
              onDelete={onDelete}
              activeConversationId={activeConversationId}
              getConversationHref={getConversationHref}
              onNavigate={onNavigate}
              variant={variant}
            />
            <ConversationGroup
              label={TIME_GROUP_LABELS.thisWeek}
              conversations={groupedConversations.thisWeek}
              onDelete={onDelete}
              activeConversationId={activeConversationId}
              getConversationHref={getConversationHref}
              onNavigate={onNavigate}
              variant={variant}
            />
            <ConversationGroup
              label={TIME_GROUP_LABELS.thisMonth}
              conversations={groupedConversations.thisMonth}
              onDelete={onDelete}
              activeConversationId={activeConversationId}
              getConversationHref={getConversationHref}
              onNavigate={onNavigate}
              variant={variant}
            />
            <ConversationGroup
              label={TIME_GROUP_LABELS.older}
              conversations={groupedConversations.older}
              onDelete={onDelete}
              activeConversationId={activeConversationId}
              getConversationHref={getConversationHref}
              onNavigate={onNavigate}
              variant={variant}
            />

            {hasNextPage && (
              <div
                ref={loadMoreRef}
                className="flex items-center justify-center py-4"
              >
                {isFetchingNextPage && (
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                )}
              </div>
            )}
          </>
        )}
      </div>
    </main>
  )
}
