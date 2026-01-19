import type { FC } from 'react'
import ProductLogo from '@/assets/product_logo.svg'
import { ThemeToggle } from '@/components/elements/theme-toggle'
import {
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import { useWorkspace } from '@/lib/workspace/use-workspace'

export const SidebarBranding: FC = () => {
  const { selectedFolder } = useWorkspace()

  return (
    <SidebarHeader>
      <SidebarMenu>
        <SidebarMenuItem className="flex items-center justify-between">
          <div className="flex items-center gap-2 px-2 py-1.5">
            <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
              <img src={ProductLogo} alt="BrowserOS" className="size-5" />
            </div>
            <div className="flex flex-col gap-0.5 leading-none">
              <span className="font-semibold">
                {selectedFolder?.name || 'BrowserOS'}
              </span>
              <span className="text-muted-foreground text-xs">Personal</span>
            </div>
          </div>
          <ThemeToggle className="h-8 w-8" iconClassName="h-4 w-4" />
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarHeader>
  )
}
