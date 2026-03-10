import type { FC } from 'react'
import { Outlet } from 'react-router'
import { ChatSessionProvider } from '@/entrypoints/sidepanel/layout/ChatSessionContext'
import { NewTabFocusGrid } from './NewTabFocusGrid'

export const NewTabLayout: FC = () => {
  return (
    <ChatSessionProvider origin="newtab">
      <NewTabFocusGrid />
      <Outlet />
    </ChatSessionProvider>
  )
}
