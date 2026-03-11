import type { FC } from 'react'
import { MessageResponse } from '@/components/ai-elements/message'
import { cn } from '@/lib/utils'

interface MarkdownPreviewProps {
  content: string
  className?: string
  emptyMessage?: string
}

export const MarkdownPreview: FC<MarkdownPreviewProps> = ({
  content,
  className,
  emptyMessage = 'Nothing here yet.',
}) => {
  if (!content.trim()) {
    return (
      <div
        className={cn(
          'flex min-h-40 items-center justify-center rounded-2xl border border-border/70 border-dashed bg-muted/20 px-6 py-10 text-center text-muted-foreground text-sm',
          className,
        )}
      >
        {emptyMessage}
      </div>
    )
  }

  return (
    <div
      className={cn(
        "prose prose-sm dark:prose-invert [&_[data-streamdown='code-block']]:!w-full [&_[data-streamdown='table-wrapper']]:!w-full max-w-none break-words rounded-2xl border border-border/70 bg-muted/20 p-4",
        className,
      )}
    >
      <MessageResponse className="[&_[data-streamdown='code-block']]:!w-full [&_[data-streamdown='table-wrapper']]:!w-full">
        {content}
      </MessageResponse>
    </div>
  )
}
