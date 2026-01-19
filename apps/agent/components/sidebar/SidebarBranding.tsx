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
    <div
      className={cn(
        'flex items-center border-b p-3',
        expanded ? 'justify-between' : 'justify-center',
      )}
    >
      <div
        className={cn('flex items-center gap-2', !expanded && 'justify-center')}
      >
        <div className="flex aspect-square size-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
          <img src={ProductLogo} alt="BrowserOS" className="size-5" />
        </div>
        {expanded && (
          <div className="flex flex-col gap-0.5 leading-none">
            <span className="max-w-32 truncate font-semibold">
              {selectedFolder?.name || 'BrowserOS'}
            </span>
            <span className="text-muted-foreground text-xs">Personal</span>
          </div>
        )}
      </div>
      {expanded && (
        <ThemeToggle className="h-8 w-8 shrink-0" iconClassName="h-4 w-4" />
      )}
    </div>
  )
}
