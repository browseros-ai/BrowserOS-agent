import type { FC } from 'react'
import ProductLogo from '@/assets/product_logo.svg'
import { ThemeToggle } from '@/components/elements/theme-toggle'
import { cn } from '@/lib/utils'
import { useWorkspace } from '@/lib/workspace/use-workspace'

interface SidebarBrandingProps {
  expanded?: boolean
  onToggle?: () => void
}

export const SidebarBranding: FC<SidebarBrandingProps> = ({
  expanded = true,
  onToggle,
}) => {
  const { selectedFolder } = useWorkspace()

  return (
    <div className="flex h-14 items-center border-b">
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation()
          onToggle?.()
        }}
        className="flex w-14 shrink-0 items-center justify-center transition-opacity hover:opacity-70 active:opacity-50"
        aria-label={expanded ? 'Collapse sidebar' : 'Expand sidebar'}
        data-sidebar-toggle
      >
        <img src={ProductLogo} alt="BrowserOS" className="size-9" />
      </button>
      <div
        className={cn(
          'flex min-w-0 flex-1 items-center justify-between pr-3 transition-opacity duration-200',
          expanded ? 'opacity-100' : 'opacity-0',
        )}
      >
        <div className="flex min-w-0 flex-col gap-0.5 leading-none">
          <span className="truncate font-semibold">
            {selectedFolder?.name || 'BrowserOS'}
          </span>
          <span className="text-muted-foreground text-xs">Personal</span>
        </div>
        <div data-sidebar-interactive>
          <ThemeToggle className="h-8 w-8 shrink-0" iconClassName="h-4 w-4" />
        </div>
      </div>
    </div>
  )
}
