import { Check } from 'lucide-react'
import type { FC } from 'react'
import type { SearchProviderConfig } from '@/lib/search-provider/providers'
import { cn } from '@/lib/utils'

interface SearchProviderCardProps {
  provider: SearchProviderConfig
  isSelected: boolean
  onSelect: (provider: SearchProviderConfig) => void
}

export const SearchProviderCard: FC<SearchProviderCardProps> = ({
  provider,
  isSelected,
  onSelect,
}) => {
  return (
    <button
      type="button"
      onClick={() => onSelect(provider)}
      className={cn(
        'group relative flex w-full flex-col items-start gap-3 rounded-xl border p-5 text-left transition-all',
        'hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        isSelected
          ? 'border-[var(--accent-orange)] bg-[var(--accent-orange)]/5 shadow-sm'
          : 'border-border bg-card shadow-sm hover:border-[var(--accent-orange)]/40',
      )}
    >
      <div className="flex w-full items-center justify-between">
        <span
          className={cn(
            'font-semibold text-base transition-colors',
            isSelected && 'text-[var(--accent-orange)]',
          )}
        >
          {provider.name}
        </span>
        <div
          className={cn(
            'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-all',
            isSelected
              ? 'border-[var(--accent-orange)] bg-[var(--accent-orange)]'
              : 'border-muted-foreground/30 group-hover:border-muted-foreground/50',
          )}
        >
          {isSelected && <Check className="h-3.5 w-3.5 text-white" />}
        </div>
      </div>
      <p className="text-muted-foreground text-sm leading-relaxed">
        {provider.description}
      </p>
    </button>
  )
}
