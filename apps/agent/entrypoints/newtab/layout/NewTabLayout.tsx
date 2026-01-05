import { LayoutGroup } from 'motion/react'
import type { FC } from 'react'
import { Outlet } from 'react-router'
import { ThemeToggle } from '@/components/elements/theme-toggle'
import { NewTabFocusGrid } from './NewTabFocusGrid'

export const NewTabLayout: FC = () => {
  return (
    <div className="relative flex min-h-screen flex-col items-center overflow-hidden bg-background px-6">
      {/* Subtle grid background */}
      <NewTabFocusGrid />

      <div className="fixed top-6 right-6 z-50">
        <ThemeToggle />
      </div>

      <LayoutGroup>
        <Outlet />
      </LayoutGroup>
    </div>
  )
}
