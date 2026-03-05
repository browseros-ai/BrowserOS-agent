import { Globe2, Trash2 } from 'lucide-react'
import type { FC } from 'react'
import { useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { getFaviconUrl, type LlmHubProvider } from './models'

interface HubProviderRowProps {
  provider: LlmHubProvider
  canDelete: boolean
  onEdit: () => void
  onDelete: () => void
}

export const HubProviderRow: FC<HubProviderRowProps> = ({
  provider,
  canDelete,
  onEdit,
  onDelete,
}) => {
  const iconUrl = useMemo(() => getFaviconUrl(provider.url), [provider.url])
  const normalizedName = provider.name.trim().toLowerCase()
  const normalizedUrl = provider.url.trim().toLowerCase()
  const isKimi = normalizedName === 'kimi' || normalizedUrl.includes('kimi.com')
  const showKimiFlare = isKimi

  return (
    <div
      className={cn(
        'group flex w-full items-center gap-4 rounded-xl border border-border bg-card p-4 transition-all hover:border-[var(--accent-orange)] hover:shadow-md',
        showKimiFlare &&
          'border-orange-300/80 bg-orange-50/20 shadow-sm ring-1 ring-orange-300/45 dark:bg-orange-500/5',
      )}
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted">
        {iconUrl ? (
          <img
            src={iconUrl}
            alt={`${provider.name} icon`}
            className="h-full w-full object-cover"
          />
        ) : (
          <Globe2 className="h-5 w-5 text-muted-foreground" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="mb-0.5 flex items-center gap-2">
          <span className="block truncate font-semibold">{provider.name}</span>
          {showKimiFlare && (
            <div className="flex flex-wrap items-center gap-1">
              <span className="rounded-full border border-orange-300/60 bg-orange-100/70 px-2 py-0.5 font-semibold text-[11px] text-orange-700 dark:border-orange-400/40 dark:bg-orange-500/15 dark:text-orange-300">
                Recommended
              </span>
              <span className="rounded-full border border-orange-300/60 bg-orange-100/60 px-2.5 py-0.5 font-medium text-orange-700 text-xs dark:border-orange-400/40 dark:bg-orange-500/15 dark:text-orange-300">
                Powered by Moonshot AI
              </span>
            </div>
          )}
        </div>
        <p className="truncate text-muted-foreground/70 text-xs">
          {provider.url}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <Button variant="outline" size="sm" onClick={onEdit}>
          Edit
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          disabled={!canDelete}
          className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-30"
          onClick={onDelete}
          aria-label={`Remove ${provider.name}`}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
