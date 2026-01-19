import {
  Bot,
  CalendarClock,
  ChevronRight,
  GitBranch,
  Home,
  MessageSquare,
  Palette,
  PlugZap,
  RotateCcw,
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Feature } from '@/lib/browseros/capabilities'
import { useCapabilities } from '@/lib/browseros/useCapabilities'
import { cn } from '@/lib/utils'

interface SidebarNavigationProps {
  expanded?: boolean
}

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
  { name: 'Revisit Onboarding', to: '/onboarding', icon: RotateCcw },
]

const navItemClasses =
  'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
const activeNavItemClasses = 'bg-sidebar-accent text-sidebar-accent-foreground'

export const SidebarNavigation: FC<SidebarNavigationProps> = ({
  expanded = true,
}) => {
  const location = useLocation()
  const { supports } = useCapabilities()

  const isSettingsActive = location.pathname.startsWith('/settings')

  const filteredPrimaryItems = primaryNavItems.filter(
    (item) => !item.feature || supports(item.feature),
  )

  const filteredSettingsItems = settingsNavItems.filter(
    (item) => !item.feature || supports(item.feature),
  )

  const NavItemWrapper = ({
    item,
    isActive,
    children,
  }: {
    item: NavItem
    isActive: boolean
    children: React.ReactNode
  }) => {
    if (!expanded) {
      return (
        <Tooltip>
          <TooltipTrigger asChild>{children}</TooltipTrigger>
          <TooltipContent side="right">{item.name}</TooltipContent>
        </Tooltip>
      )
    }
    return <>{children}</>
  }

  return (
    <TooltipProvider delayDuration={0}>
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-2">
        <nav className="space-y-1">
          {filteredPrimaryItems.map((item) => {
            const Icon = item.icon
            const isActive =
              location.pathname === item.to ||
              location.pathname.startsWith(`${item.to}/`)

            return (
              <NavItemWrapper key={item.to} item={item} isActive={isActive}>
                <NavLink
                  to={item.to}
                  className={cn(
                    navItemClasses,
                    isActive && activeNavItemClasses,
                    !expanded && 'justify-center px-2',
                  )}
                >
                  <Icon className="size-4 shrink-0" />
                  {expanded && <span className="truncate">{item.name}</span>}
                </NavLink>
              </NavItemWrapper>
            )
          })}

          {expanded ? (
            <Collapsible defaultOpen={isSettingsActive} className="space-y-1">
              <CollapsibleTrigger
                className={cn(
                  navItemClasses,
                  'w-full justify-between',
                  isSettingsActive && activeNavItemClasses,
                )}
              >
                <div className="flex items-center gap-2">
                  <Bot className="size-4 shrink-0" />
                  <span>Settings</span>
                </div>
                <ChevronRight className="size-4 transition-transform duration-200 [[data-state=open]>&]:rotate-90" />
              </CollapsibleTrigger>
              <CollapsibleContent className="ml-4 space-y-1 border-l pl-2">
                {filteredSettingsItems.map((item) => {
                  const isActive = location.pathname === item.to

                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      className={cn(
                        'flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                        isActive && activeNavItemClasses,
                      )}
                    >
                      <span className="truncate">{item.name}</span>
                    </NavLink>
                  )
                })}
              </CollapsibleContent>
            </Collapsible>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <NavLink
                  to="/settings/ai"
                  className={cn(
                    navItemClasses,
                    'justify-center px-2',
                    isSettingsActive && activeNavItemClasses,
                  )}
                >
                  <Bot className="size-4 shrink-0" />
                </NavLink>
              </TooltipTrigger>
              <TooltipContent side="right">Settings</TooltipContent>
            </Tooltip>
          )}
        </nav>
      </div>
    </TooltipProvider>
  )
}
