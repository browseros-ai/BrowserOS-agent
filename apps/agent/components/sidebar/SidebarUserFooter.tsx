import { Info, LogIn } from 'lucide-react'
import type { FC } from 'react'
import { Button } from '@/components/ui/button'
import {
  SidebarFooter,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'

export const SidebarUserFooter: FC = () => {
  return (
    <SidebarFooter>
      <SidebarMenu>
        <SidebarMenuItem>
          <Button
            variant="outline"
            className="w-full justify-start gap-2"
            disabled
          >
            <LogIn className="size-4" />
            <span>Sign in to BrowserOS</span>
          </Button>
        </SidebarMenuItem>
        <SidebarMenuItem>
          <SidebarMenuButton asChild>
            <a
              href="https://docs.browseros.com/"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Info className="size-4" />
              <span>About BrowserOS</span>
            </a>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarFooter>
  )
}
