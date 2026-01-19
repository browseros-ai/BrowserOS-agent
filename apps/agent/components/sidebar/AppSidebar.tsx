import type { FC } from 'react'
import { Sidebar } from '@/components/ui/sidebar'
import { SidebarBranding } from './SidebarBranding'
import { SidebarNavigation } from './SidebarNavigation'
import { SidebarUserFooter } from './SidebarUserFooter'

export const AppSidebar: FC = () => {
  return (
    <Sidebar>
      <SidebarBranding />
      <SidebarNavigation />
      <SidebarUserFooter />
    </Sidebar>
  )
}
