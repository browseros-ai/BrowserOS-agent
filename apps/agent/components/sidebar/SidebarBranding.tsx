import type { FC } from 'react'
import ProductLogo from '@/assets/product_logo.svg'
import { ThemeToggle } from '@/components/elements/theme-toggle'
import { cn } from '@/lib/utils'
import { useWorkspace } from '@/lib/workspace/use-workspace'

interface SidebarBrandingProps {
  expanded?: boolean
}

export const SidebarBranding: FC<SidebarBrandingProps> = ({
  expanded = true,
}) => {
  const { selectedFolder } = useWorkspace()

  return (
    <div className="flex h-14 items-center justify-between overflow-hidden border-b px-3">
      <div className="flex min-w-0 items-center gap-2">
        <div className="flex aspect-square size-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
          <img src={ProductLogo} alt="BrowserOS" className="size-5" />
        </div>
        <div
          className={cn(
            'flex min-w-0 flex-col gap-0.5 leading-none transition-opacity duration-200',
            expanded ? 'opacity-100' : 'opacity-0',
          )}
        >
          <span className="truncate font-semibold">
            {selectedFolder?.name || 'BrowserOS'}
          </span>
          <span className="text-muted-foreground text-xs">Personal</span>
        </div>
      </div>
      <ThemeToggle
        className={cn(
          'h-8 w-8 shrink-0 transition-opacity duration-200',
          expanded ? 'opacity-100' : 'opacity-0',
        )}
        iconClassName="h-4 w-4"
      />
    </div>
  )
}
