import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import { MessageSquare, Trash2 } from 'lucide-react'
import { type FC, useState } from 'react'
import { Link } from 'react-router'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { cn } from '@/lib/utils'
import type { HistoryConversation, HistoryListVariant } from './types'

dayjs.extend(relativeTime)

interface ConversationItemProps {
  conversation: HistoryConversation
  onDelete?: (id: string) => void
  isActive: boolean
  href: string
  onNavigate?: () => void
  variant?: HistoryListVariant
}

export const ConversationItem: FC<ConversationItemProps> = ({
  conversation,
  onDelete,
  isActive,
  href,
  onNavigate,
  variant = 'sidepanel',
}) => {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const label = conversation.lastUserMessage
  const relativeTimeAgo = dayjs(conversation.lastMessagedAt).fromNow()

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setShowDeleteDialog(true)
  }

  const handleConfirmDelete = () => {
    onDelete?.(conversation.id)
    setShowDeleteDialog(false)
  }

  return (
    <>
      <Link
        to={href}
        onClick={onNavigate}
        className={cn(
          'group flex w-full items-start gap-3 transition-all',
          variant === 'page'
            ? 'rounded-2xl border border-border/70 bg-background/80 px-4 py-3 shadow-sm hover:-translate-y-px hover:border-primary/20 hover:bg-card hover:shadow-md'
            : 'rounded-lg px-3 py-2.5 hover:bg-muted/50',
          isActive &&
            (variant === 'page'
              ? 'border-primary/25 bg-primary/5 shadow-md'
              : 'bg-muted/70'),
        )}
      >
        <div
          className={cn(
            'shrink-0',
            variant === 'page' &&
              'flex size-10 items-center justify-center rounded-xl border border-border/70 bg-muted/60',
            isActive ? 'text-primary' : 'text-muted-foreground',
          )}
        >
          <MessageSquare
            className={cn(variant === 'page' ? 'h-4 w-4' : 'mt-0.5 h-4 w-4')}
          />
        </div>
        <div className="min-w-0 flex-1 overflow-hidden">
          <p
            className={cn(
              'truncate font-medium text-foreground',
              variant === 'page' ? 'text-sm leading-5' : 'text-sm',
            )}
          >
            {label}
          </p>
          <p
            className={cn(
              'text-muted-foreground',
              variant === 'page'
                ? 'mt-1 text-[11px] uppercase tracking-[0.14em]'
                : 'text-xs',
            )}
          >
            {relativeTimeAgo}
          </p>
        </div>
        {onDelete && (
          <button
            type="button"
            onClick={handleDeleteClick}
            className={cn(
              'shrink-0 rounded p-1 text-muted-foreground transition-opacity hover:bg-destructive/10 hover:text-destructive',
              'opacity-0 group-hover:opacity-100',
            )}
            title="Delete conversation"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </Link>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete conversation?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete your
              conversation and all its messages.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
