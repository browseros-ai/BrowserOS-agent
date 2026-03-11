import type { FC } from 'react'
import { Outlet, useLocation } from 'react-router'
import { ChatSessionProvider } from '@/entrypoints/sidepanel/layout/ChatSessionContext'
import { NewTabFocusGrid } from './NewTabFocusGrid'

export const NewTabLayout: FC = () => {
  const location = useLocation()

  return (
    <ChatSessionProvider origin="newtab">
      {location.pathname !== '/home/soul' &&
        location.pathname !== '/home/memory' &&
        location.pathname !== '/home/skills' && <NewTabFocusGrid />}
      <Outlet />
    </ChatSessionProvider>
  )
}
