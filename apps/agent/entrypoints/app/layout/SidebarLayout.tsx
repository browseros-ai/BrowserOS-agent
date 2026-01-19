import type { FC } from 'react'
import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router'
import { AppSidebar } from '@/components/sidebar/AppSidebar'
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar'
import { SETTINGS_PAGE_VIEWED_EVENT } from '@/lib/constants/analyticsEvents'
import { track } from '@/lib/metrics/track'
import { RpcClientProvider } from '@/lib/rpc/RpcClientProvider'

export const SidebarLayout: FC = () => {
  const location = useLocation()

  useEffect(() => {
    track(SETTINGS_PAGE_VIEWED_EVENT, { page: location.pathname })
  }, [location.pathname])

  return (
    <RpcClientProvider>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4 md:hidden">
            <SidebarTrigger className="-ml-1" />
            <span className="font-semibold">BrowserOS</span>
          </header>
          <main className="flex-1 overflow-y-auto">
            <div className="mx-auto max-w-5xl overflow-hidden px-4 py-8 sm:px-6 lg:px-8">
              <Outlet />
            </div>
          </main>
        </SidebarInset>
      </SidebarProvider>
    </RpcClientProvider>
  )
}
