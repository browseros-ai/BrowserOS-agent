import { FileText, Loader2 } from 'lucide-react'
import type { FC } from 'react'
import { useSoulContent } from './useSoulContent'

export const SoulViewer: FC = () => {
  const { content, isLoading, error } = useSoulContent()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-border bg-card p-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-xl border border-destructive/50 bg-destructive/5 p-6">
        <p className="text-destructive text-sm">
          Could not load soul file. Make sure BrowserOS server is running.
        </p>
      </div>
    )
  }

  if (!content) {
    return (
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <FileText className="h-8 w-8 text-muted-foreground/50" />
          <div>
            <p className="font-medium text-sm">No soul file yet</p>
            <p className="mt-1 text-muted-foreground text-xs">
              Start a conversation and your agent will create its personality.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm">
      <div className="border-border border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium text-sm">SOUL.md</span>
          <span className="text-muted-foreground text-xs">read-only</span>
        </div>
      </div>
      <pre className="overflow-x-auto whitespace-pre-wrap p-4 font-mono text-sm leading-relaxed">
        {content}
      </pre>
    </div>
  )
}
