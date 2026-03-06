import { Search } from 'lucide-react'
import type { FC } from 'react'
import type { SearchProviderConfig } from '@/lib/search-provider/providers'

interface SearchProviderHeaderProps {
  activeProvider: SearchProviderConfig
}

export const SearchProviderHeader: FC<SearchProviderHeaderProps> = ({
  activeProvider,
}) => {
  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm transition-all hover:shadow-md">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-orange)]/10">
          <Search className="h-6 w-6 text-[var(--accent-orange)]" />
        </div>
        <div className="flex-1">
          <h2 className="mb-1 font-semibold text-xl">Search Provider</h2>
          <p className="text-muted-foreground text-sm">
            Choose the default search engine for your browser's address bar and
            new tab page
          </p>
          <div className="mt-3 inline-flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-1.5">
            <span className="text-muted-foreground text-xs">
              Currently using:
            </span>
            <span className="font-medium text-sm">{activeProvider.name}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
