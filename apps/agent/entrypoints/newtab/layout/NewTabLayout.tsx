import { LayoutGroup } from 'motion/react'
import type { FC } from 'react'
import { Outlet } from 'react-router'
import { NewTabSidebar } from '@/components/sidebar/NewTabSidebar'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { NewTabFocusGrid } from './NewTabFocusGrid'
import { ShortcutsProvider, useShortcuts } from './ShortcutsContext'

const NewTabLayoutContent: FC = () => {
  const { openShortcuts } = useShortcuts()

  return (
    <SidebarProvider
      defaultOpen={false}
      style={
        {
          '--sidebar-width': '76px',
          '--sidebar-width-icon': '76px',
        } as React.CSSProperties
      }
    >
      <NewTabSidebar onOpenShortcuts={openShortcuts} />

      <SidebarInset className="flex min-h-screen flex-1 flex-col items-center overflow-hidden bg-background px-6">
        <NewTabFocusGrid />

        <LayoutGroup>
          <Outlet />
        </LayoutGroup>
      </SidebarInset>
    </SidebarProvider>
  )
}

export const NewTabLayout: FC = () => {
  return (
    <ShortcutsProvider>
      <NewTabLayoutContent />
    </ShortcutsProvider>
  )
}
