import {
  Bot,
  CalendarClock,
  ChevronRight,
  GitBranch,
  Home,
  MessageSquare,
  Palette,
  PlugZap,
  Server,
} from 'lucide-react'
import type { FC } from 'react'
import { NavLink, useLocation } from 'react-router'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from '@/components/ui/sidebar'
import { Feature } from '@/lib/browseros/capabilities'
import { useCapabilities } from '@/lib/browseros/useCapabilities'

type NavItem = {
  name: string
  to: string
  icon: typeof Home
  feature?: Feature
}

const primaryNavItems: NavItem[] = [
  { name: 'Home', to: '/home', icon: Home },
  {
    name: 'Workflows',
    to: '/workflows',
    icon: GitBranch,
    feature: Feature.WORKFLOW_SUPPORT,
  },
  { name: 'Scheduled', to: '/scheduled', icon: CalendarClock },
]

const settingsNavItems: NavItem[] = [
  { name: 'BrowserOS AI', to: '/settings/ai', icon: Bot },
  { name: 'LLM Chat & Hub', to: '/settings/chat', icon: MessageSquare },
  {
    name: 'Connect to MCPs',
    to: '/settings/connect-mcp',
    icon: PlugZap,
    feature: Feature.MANAGED_MCP_SUPPORT,
  },
  { name: 'BrowserOS as MCP', to: '/settings/mcp', icon: Server },
  {
    name: 'Customization',
    to: '/settings/customization',
    icon: Palette,
    feature: Feature.CUSTOMIZATION_SUPPORT,
  },
]

export const SidebarNavigation: FC = () => {
  const location = useLocation()
  const { supports } = useCapabilities()

  const isSettingsActive = location.pathname.startsWith('/settings')

  const filteredPrimaryItems = primaryNavItems.filter(
    (item) => !item.feature || supports(item.feature),
  )

  const filteredSettingsItems = settingsNavItems.filter(
    (item) => !item.feature || supports(item.feature),
  )

  return (
    <SidebarContent>
      <SidebarGroup>
        <SidebarGroupLabel>Navigation</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            {filteredPrimaryItems.map((item) => {
              const Icon = item.icon
              const isActive =
                location.pathname === item.to ||
                location.pathname.startsWith(`${item.to}/`)

              return (
                <SidebarMenuItem key={item.to}>
                  <SidebarMenuButton asChild isActive={isActive}>
                    <NavLink to={item.to}>
                      <Icon className="size-4" />
                      <span>{item.name}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )
            })}

            <Collapsible
              defaultOpen={isSettingsActive}
              className="group/collapsible"
            >
              <SidebarMenuItem>
                <CollapsibleTrigger asChild>
                  <SidebarMenuButton isActive={isSettingsActive}>
                    <Bot className="size-4" />
                    <span>Settings</span>
                    <ChevronRight className="ml-auto size-4 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                  </SidebarMenuButton>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarMenuSub>
                    {filteredSettingsItems.map((item) => {
                      const isActive = location.pathname === item.to

                      return (
                        <SidebarMenuSubItem key={item.to}>
                          <SidebarMenuSubButton asChild isActive={isActive}>
                            <NavLink to={item.to}>
                              <span>{item.name}</span>
                            </NavLink>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      )
                    })}
                  </SidebarMenuSub>
                </CollapsibleContent>
              </SidebarMenuItem>
            </Collapsible>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </SidebarContent>
  )
}
