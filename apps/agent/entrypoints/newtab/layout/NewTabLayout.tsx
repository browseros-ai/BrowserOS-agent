import { LayoutGroup } from 'motion/react'
import type { FC } from 'react'
import { Outlet } from 'react-router'
import { NewTabSidebar } from '@/components/sidebar/NewTabSidebar'
import { NewTabFocusGrid } from './NewTabFocusGrid'
import { ShortcutsProvider } from './ShortcutsContext'

const NewTabLayoutContent: FC = () => {
  return (
    <div className="flex min-h-screen bg-background">
      <NewTabSidebar />

      {/* Main content with left margin to account for fixed sidebar */}
      <main className="ml-14 flex flex-1 flex-col items-center overflow-hidden px-6">
        <NewTabFocusGrid />

        <LayoutGroup>
          <Outlet />
        </LayoutGroup>
      </main>
    </div>
  )
}

export const NewTabLayout: FC = () => {
  return (
    <ShortcutsProvider>
      <NewTabLayoutContent />
    </ShortcutsProvider>
  )
}
