import { Globe2, Trash2 } from 'lucide-react'
import type { FC } from 'react'
import { useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { useKimiLaunch } from '@/lib/feature-flags/useKimiLaunch'
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
  const kimiLaunch = useKimiLaunch()
  const showKimiFlare = isKimi && kimiLaunch

  return (
    <div
      className={cn(
        'group flex w-full items-center gap-4 rounded-xl border border-border bg-card p-4 transition-all hover:border-[var(--accent-orange)] hover:shadow-md',
        showKimiFlare &&
          'border-orange-400/60 shadow-[0_0_15px_rgba(251,146,60,0.3)] ring-2 ring-orange-400/40',
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
              <span className="rounded-full border border-orange-300/60 bg-orange-50 px-2 py-0.5 font-semibold text-[11px] text-orange-700">
                Recommended
              </span>
              <span className="rounded-full bg-gradient-to-r from-orange-500 to-amber-500 px-2.5 py-0.5 font-medium text-white text-xs">
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
