import type { FC } from 'react'
import { Sidebar, SidebarRail } from '@/components/ui/sidebar'
import { SidebarBranding } from './SidebarBranding'
import { SidebarNavigation } from './SidebarNavigation'
import { SidebarUserFooter } from './SidebarUserFooter'

export const AppSidebar: FC = () => {
  return (
    <Sidebar collapsible="icon">
      <SidebarBranding />
      <SidebarNavigation />
      <SidebarUserFooter />
      <SidebarRail />
    </Sidebar>
  )
}
