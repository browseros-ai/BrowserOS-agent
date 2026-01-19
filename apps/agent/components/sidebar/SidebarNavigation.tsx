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
  UserPen,
} from 'lucide-react'
import { type FC, useEffect, useState } from 'react'
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
  {
    name: 'Personalize',
    to: '/home/personalize',
    icon: UserPen,
  },
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

const SETTINGS_COLLAPSED_KEY = 'sidebar-settings-collapsed'

export const SidebarNavigation: FC<SidebarNavigationProps> = ({
  expanded = true,
}) => {
  const location = useLocation()
  const { supports } = useCapabilities()

  const isSettingsActive = location.pathname.startsWith('/settings')

  const [settingsOpen, setSettingsOpen] = useState(() => {
    if (typeof window === 'undefined') return true
    const stored = localStorage.getItem(SETTINGS_COLLAPSED_KEY)
    return stored === null ? true : stored !== 'true'
  })

  useEffect(() => {
    if (isSettingsActive && !settingsOpen) {
      setSettingsOpen(true)
    }
  }, [isSettingsActive, settingsOpen])

  const handleSettingsOpenChange = (open: boolean) => {
    setSettingsOpen(open)
    localStorage.setItem(SETTINGS_COLLAPSED_KEY, (!open).toString())
  }

  const filteredPrimaryItems = primaryNavItems.filter(
    (item) => !item.feature || supports(item.feature),
  )

  const filteredSettingsItems = settingsNavItems.filter(
    (item) => !item.feature || supports(item.feature),
  )

  return (
    <TooltipProvider delayDuration={0}>
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-2">
        <nav className="space-y-1">
          {filteredPrimaryItems.map((item) => {
            const Icon = item.icon
            const isActive =
              location.pathname === item.to ||
              location.pathname.startsWith(`${item.to}/`)

            const navItem = (
              <NavLink
                to={item.to}
                className={cn(
                  'flex h-9 items-center gap-2 overflow-hidden whitespace-nowrap rounded-md px-3 font-medium text-sm transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                  isActive &&
                    'bg-sidebar-accent text-sidebar-accent-foreground',
                )}
              >
                <Icon className="size-4 shrink-0" />
                <span
                  className={cn(
                    'truncate transition-opacity duration-200',
                    expanded ? 'opacity-100' : 'opacity-0',
                  )}
                >
                  {item.name}
                </span>
              </NavLink>
            )

            if (!expanded) {
              return (
                <Tooltip key={item.to}>
                  <TooltipTrigger asChild>{navItem}</TooltipTrigger>
                  <TooltipContent side="right">{item.name}</TooltipContent>
                </Tooltip>
              )
            }

            return <div key={item.to}>{navItem}</div>
          })}

          {expanded ? (
            <Collapsible
              open={settingsOpen}
              onOpenChange={handleSettingsOpenChange}
              className="space-y-1"
            >
              <CollapsibleTrigger
                className={cn(
                  'flex h-9 w-full items-center justify-between gap-2 overflow-hidden whitespace-nowrap rounded-md px-3 font-medium text-sm transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                  isSettingsActive &&
                    'bg-sidebar-accent text-sidebar-accent-foreground',
                )}
              >
                <div className="flex items-center gap-2">
                  <Bot className="size-4 shrink-0" />
                  <span className="truncate">Settings</span>
                </div>
                <ChevronRight className="size-4 shrink-0 transition-transform duration-200 [[data-state=open]>&]:rotate-90" />
              </CollapsibleTrigger>
              <CollapsibleContent className="ml-4 space-y-1 border-l pl-2">
                {filteredSettingsItems.map((item) => {
                  const isActive = location.pathname === item.to

                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      className={cn(
                        'flex h-8 items-center gap-2 overflow-hidden whitespace-nowrap rounded-md px-3 text-sm transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                        isActive &&
                          'bg-sidebar-accent text-sidebar-accent-foreground',
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
                    'flex h-9 items-center gap-2 overflow-hidden whitespace-nowrap rounded-md px-3 font-medium text-sm transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                    isSettingsActive &&
                      'bg-sidebar-accent text-sidebar-accent-foreground',
                  )}
                >
                  <Bot className="size-4 shrink-0" />
                  <span className="truncate opacity-0 transition-opacity duration-200">
                    Settings
                  </span>
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
