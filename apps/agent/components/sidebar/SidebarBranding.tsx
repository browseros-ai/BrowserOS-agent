import type { FC } from 'react'
import ProductLogo from '@/assets/product_logo.svg'
import { ThemeToggle } from '@/components/elements/theme-toggle'
import { cn } from '@/lib/utils'
import { useWorkspace } from '@/lib/workspace/use-workspace'
import { SidebarUserMenu } from './SidebarUserMenu'

interface SidebarBrandingProps {
  expanded?: boolean
}

export const SidebarBranding: FC<SidebarBrandingProps> = ({
  expanded = true,
}) => {
  const { selectedFolder } = useWorkspace()

  return (
    <div className="flex flex-col border-b">
      <div className="flex h-14 items-center">
        <div className="flex w-14 shrink-0 items-center justify-center">
          <img src={ProductLogo} alt="BrowserOS" className="size-8" />
        </div>
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
          <ThemeToggle className="h-8 w-8 shrink-0" iconClassName="h-4 w-4" />
        </div>
      </div>
      <div className={cn('px-2 pb-2', !expanded && 'flex justify-center')}>
        <SidebarUserMenu expanded={expanded} />
      </div>
    </div>
  )
}
