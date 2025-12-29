import { Check, Globe2, Trash2 } from 'lucide-react'
import type { FC, KeyboardEvent } from 'react'
import { useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { getFaviconUrl, type LlmHubProvider } from './models'

interface HubProviderRowProps {
  provider: LlmHubProvider
  isSelected: boolean
  canDelete: boolean
  onSelect: () => void
  onEdit: () => void
  onDelete: () => void
}

export const HubProviderRow: FC<HubProviderRowProps> = ({
  provider,
  isSelected,
  canDelete,
  onSelect,
  onEdit,
  onDelete,
}) => {
  const iconUrl = useMemo(() => getFaviconUrl(provider.url), [provider.url])

  const handleRowClick = () => {
    if (!isSelected) {
      onSelect()
    }
  }

  const handleRowKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      handleRowClick()
    }
  }

  return (
    <button
      type="button"
      onClick={handleRowClick}
      onKeyDown={handleRowKeyDown}
      className={cn(
        'group flex w-full cursor-pointer items-center gap-4 rounded-xl border p-4 text-left transition-all',
        isSelected
          ? 'border-[var(--accent-orange)] bg-[var(--accent-orange)]/5 shadow-md'
          : 'border-border bg-card hover:border-[var(--accent-orange)]/50 hover:shadow-sm',
      )}
    >
      <div
        className={cn(
          'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-all',
          isSelected
            ? 'border-[var(--accent-orange)] bg-[var(--accent-orange)]'
            : 'border-border',
        )}
      >
        {isSelected && <Check className="h-3 w-3 text-white" />}
      </div>

      <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted">
        {iconUrl ? (
          <img
            src={iconUrl}
            alt={`${provider.name} icon`}
            className="h-full w-full object-cover opacity-60 grayscale"
          />
        ) : (
          <Globe2 className="h-5 w-5 text-muted-foreground" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <span className="mb-0.5 block truncate font-semibold">
          {provider.name}
        </span>
        <p className="truncate text-muted-foreground/70 text-xs">
          {provider.url}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={(e) => {
            e.stopPropagation()
            onEdit()
          }}
        >
          Edit
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          disabled={!canDelete}
          className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-30"
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
          aria-label={`Remove ${provider.name}`}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </button>
  )
}
