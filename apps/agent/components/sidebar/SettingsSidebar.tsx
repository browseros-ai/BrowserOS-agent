import {
  ArrowLeft,
  Bot,
  MessageSquare,
  Palette,
  PlugZap,
  RotateCcw,
  Server,
} from 'lucide-react'
import type { FC } from 'react'
import { NavLink, useLocation } from 'react-router'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Feature } from '@/lib/browseros/capabilities'
import { useCapabilities } from '@/lib/browseros/useCapabilities'
import { cn } from '@/lib/utils'

interface SettingsSidebarProps {
  expanded?: boolean
}

type NavItem = {
  name: string
  to: string
  icon: typeof Bot
  feature?: Feature
}

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

export const SettingsSidebar: FC<SettingsSidebarProps> = ({
  expanded = false,
}) => {
  const location = useLocation()
  const { supports } = useCapabilities()

  const filteredItems = settingsNavItems.filter(
    (item) => !item.feature || supports(item.feature),
  )

  const backButton = (
    <NavLink
      to="/home"
      className="flex h-9 items-center gap-2 overflow-hidden whitespace-nowrap rounded-md px-3 font-medium text-sm transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
    >
      <ArrowLeft className="size-4 shrink-0" />
      <span
        className={cn(
          'truncate transition-opacity duration-200',
          expanded ? 'opacity-100' : 'opacity-0',
        )}
      >
        Back
      </span>
    </NavLink>
  )

  return (
    <div
      className={cn(
        'flex h-full flex-col border-r bg-sidebar text-sidebar-foreground transition-all duration-200 ease-in-out',
        expanded ? 'w-64' : 'w-14',
      )}
    >
      <div className="flex h-14 items-center border-b px-2">
        <TooltipProvider delayDuration={0}>
          {expanded ? (
            backButton
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>{backButton}</TooltipTrigger>
              <TooltipContent side="right">Back to Home</TooltipContent>
            </Tooltip>
          )}
        </TooltipProvider>
      </div>

      <TooltipProvider delayDuration={0}>
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-2">
          <div
            className={cn(
              'mb-2 px-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider transition-opacity duration-200',
              expanded ? 'opacity-100' : 'opacity-0',
            )}
          >
            Settings
          </div>
          <nav className="space-y-1">
            {filteredItems.map((item) => {
              const Icon = item.icon
              const isActive = location.pathname === item.to

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
          </nav>
        </div>
      </TooltipProvider>
    </div>
  )
}
