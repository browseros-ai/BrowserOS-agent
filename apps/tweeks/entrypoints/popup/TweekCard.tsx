import { Trash2 } from 'lucide-react'
import type { Tweek } from '../../lib/api'
import { cn } from '../../lib/utils'

interface TweekCardProps {
  tweek: Tweek
  onToggle: (id: string, enabled: boolean) => void
  onDelete: (id: string) => void
}

export function TweekCard({ tweek, onToggle, onDelete }: TweekCardProps) {
  const isEnabled = Boolean(tweek.enabled)

  return (
    <div className="flex items-center gap-3 border-border border-b px-4 py-3 last:border-b-0">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'truncate font-medium text-sm',
              !isEnabled && 'text-muted-foreground',
            )}
          >
            {tweek.name}
          </span>
          <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
            {tweek.script_type.toUpperCase()}
          </span>
        </div>
        {tweek.description && (
          <p className="mt-0.5 truncate text-muted-foreground text-xs">
            {tweek.description}
          </p>
        )}
        <p className="mt-0.5 text-[10px] text-muted-foreground">
          {tweek.domain}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={() => onToggle(tweek.id, !isEnabled)}
          className={cn(
            'relative h-5 w-9 rounded-full transition-colors',
            isEnabled ? 'bg-primary' : 'bg-muted',
          )}
          title={isEnabled ? 'Disable' : 'Enable'}
        >
          <span
            className={cn(
              'absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform',
              isEnabled && 'translate-x-4',
            )}
          />
        </button>
        <button
          type="button"
          onClick={() => onDelete(tweek.id)}
          className="rounded p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
          title="Delete"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}
