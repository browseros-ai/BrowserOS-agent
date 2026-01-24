import { Menu } from 'lucide-react'
import type { FC } from 'react'
import { useCallback, useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router'
import { AppSidebar } from '@/components/sidebar/AppSidebar'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { ShortcutsDialog } from '@/entrypoints/newtab/index/ShortcutsDialog'
import { useIsMobile } from '@/hooks/use-mobile'
import { SETTINGS_PAGE_VIEWED_EVENT } from '@/lib/constants/analyticsEvents'
import { track } from '@/lib/metrics/track'
import { RpcClientProvider } from '@/lib/rpc/RpcClientProvider'

const SIDEBAR_STORAGE_KEY = 'browseros-sidebar-expanded'

export const SidebarLayout: FC = () => {
  const location = useLocation()
  const isMobile = useIsMobile()
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    // Default to collapsed (false) on first load
    const stored = localStorage.getItem(SIDEBAR_STORAGE_KEY)
    return stored === 'true'
  })
  const [mobileOpen, setMobileOpen] = useState(false)
  const [shortcutsDialogOpen, setShortcutsDialogOpen] = useState(false)

  const toggleSidebar = useCallback(() => {
    setSidebarOpen((prev) => {
      const newValue = !prev
      localStorage.setItem(SIDEBAR_STORAGE_KEY, String(newValue))
      return newValue
    })
  }, [])

  const openShortcuts = useCallback(() => {
    setShortcutsDialogOpen(true)
  }, [])

  useEffect(() => {
    track(SETTINGS_PAGE_VIEWED_EVENT, { page: location.pathname })
  }, [location.pathname])

  useEffect(() => {
    setMobileOpen(false)
  }, [])

  if (isMobile) {
    return (
      <RpcClientProvider>
        <div className="flex min-h-screen flex-col bg-background">
          <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
            <Button
              variant="ghost"
              size="icon"
              className="-ml-1 size-7"
              onClick={() => setMobileOpen(true)}
            >
              <Menu className="size-4" />
            </Button>
            <span className="font-semibold">BrowserOS</span>
          </header>
          <main className="flex-1 overflow-y-auto">
            <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
              <Outlet />
            </div>
          </main>
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetContent side="left" className="w-72 p-0">
              <AppSidebar expanded onOpenShortcuts={openShortcuts} />
            </SheetContent>
          </Sheet>
          <ShortcutsDialog
            open={shortcutsDialogOpen}
            onOpenChange={setShortcutsDialogOpen}
          />
        </div>
      </RpcClientProvider>
    )
  }

  return (
    <RpcClientProvider>
      <div className="flex min-h-screen bg-background">
        {/* Sidebar - push mode */}
        <AppSidebar
          expanded={sidebarOpen}
          onToggle={toggleSidebar}
          onOpenShortcuts={openShortcuts}
        />

        {/* Main content - adjusts based on sidebar width */}
        <main className="relative min-h-screen flex-1 overflow-y-auto">
          <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
            <Outlet />
          </div>
        </main>
      </div>
      <ShortcutsDialog
        open={shortcutsDialogOpen}
        onOpenChange={setShortcutsDialogOpen}
      />
    </RpcClientProvider>
  )
}
