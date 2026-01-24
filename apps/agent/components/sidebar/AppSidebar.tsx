import type { FC } from 'react'
import { useCallback } from 'react'
import { cn } from '@/lib/utils'
import { SidebarBranding } from './SidebarBranding'
import { SidebarNavigation } from './SidebarNavigation'
import { SidebarUserFooter } from './SidebarUserFooter'

interface AppSidebarProps {
  expanded?: boolean
  onToggle?: () => void
  onOpenShortcuts?: () => void
}

export const AppSidebar: FC<AppSidebarProps> = ({
  expanded = false,
  onToggle,
  onOpenShortcuts,
}) => {
  const handleSidebarClick = useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      const target = event.target as HTMLElement
      if (target.closest('[data-sidebar-interactive]')) {
        return
      }
      onToggle?.()
    },
    [onToggle],
  )

  return (
    <>
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: sidebar toggles via empty-space click */}
      <aside
        onClick={handleSidebarClick}
        className={cn(
          'relative z-20 flex min-h-screen shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground transition-all duration-200 ease-in-out',
          expanded ? 'w-64' : 'w-14',
        )}
      >
        <SidebarBranding expanded={expanded} onToggle={onToggle} />
        <SidebarNavigation expanded={expanded} />
        <SidebarUserFooter
          expanded={expanded}
          onOpenShortcuts={onOpenShortcuts}
        />
      </aside>
    </>
  )
}
