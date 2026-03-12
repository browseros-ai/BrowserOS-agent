import {
  ArrowLeft,
  Bot,
  Compass,
  GitBranch,
  MessageSquare,
  Palette,
  RotateCcw,
  Search,
  Server,
} from 'lucide-react'
import type { FC } from 'react'
import { NavLink, useLocation } from 'react-router'
import { ThemeToggle } from '@/components/elements/theme-toggle'
import { Feature } from '@/lib/browseros/capabilities'
import { useCapabilities } from '@/lib/browseros/useCapabilities'
import { cn } from '@/lib/utils'

type NavItem = {
  name: string
  to: string
  icon: typeof Bot
  feature?: Feature
}

type NavSection = {
  label: string
  items: NavItem[]
}

const settingsSections: NavSection[] = [
  {
    label: 'Provider Settings',
    items: [
      { name: 'BrowserOS AI', to: '/settings/ai', icon: Bot },
      {
        name: 'Chat & Hub Provider',
        to: '/settings/chat',
        icon: MessageSquare,
      },
      { name: 'Search Provider', to: '/settings/search', icon: Search },
    ],
  },
  {
    label: 'Other',
    items: [
      {
        name: 'Customization',
        to: '/settings/customization',
        icon: Palette,
        feature: Feature.CUSTOMIZATION_SUPPORT,
      },
      { name: 'BrowserOS as MCP', to: '/settings/mcp', icon: Server },
      {
        name: 'Workflows',
        to: '/workflows',
        icon: GitBranch,
        feature: Feature.WORKFLOW_SUPPORT,
      },
    ],
  },
]

const helpItems: NavItem[] = [
  { name: 'Explore Features', to: '/onboarding/features', icon: Compass },
  { name: 'Revisit Onboarding', to: '/onboarding', icon: RotateCcw },
]

const navItemClassName =
  'flex h-9 items-center gap-2 overflow-hidden whitespace-nowrap rounded-md px-3 font-medium text-sm transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'

export const SettingsSidebar: FC = () => {
  const location = useLocation()
  const { supports } = useCapabilities()

  const renderNavItem = (item: NavItem) => {
    const Icon = item.icon
    const isActive = location.pathname === item.to

    return (
      <NavLink
        key={item.to}
        to={item.to}
        className={cn(
          navItemClassName,
          isActive && 'bg-sidebar-accent text-sidebar-accent-foreground',
        )}
      >
        <Icon className="size-4 shrink-0" />
        <span className="truncate">{item.name}</span>
      </NavLink>
    )
  }

  return (
    <div className="flex h-full w-64 flex-col border-r bg-sidebar text-sidebar-foreground">
      {/* Header with back button and theme toggle */}
      <div className="flex h-14 items-center justify-between border-b px-2">
        <NavLink to="/home" className={navItemClassName}>
          <ArrowLeft className="size-4 shrink-0" />
          <span className="truncate">Back</span>
        </NavLink>
        <ThemeToggle
          className="mr-1 h-8 w-8 shrink-0"
          iconClassName="h-4 w-4"
        />
      </div>

      {/* Sections */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-2">
        {settingsSections.map((section) => {
          const visibleItems = section.items.filter(
            (item) => !item.feature || supports(item.feature),
          )
          if (visibleItems.length === 0) return null

          return (
            <div key={section.label} className="mb-4">
              <div className="mb-2 px-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">
                {section.label}
              </div>
              <nav className="space-y-1">{visibleItems.map(renderNavItem)}</nav>
            </div>
          )
        })}
      </div>

      {/* Help section at bottom */}
      <div className="border-t p-2">
        <div className="mb-2 px-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">
          Help
        </div>
        <nav className="space-y-1">{helpItems.map(renderNavItem)}</nav>
      </div>
    </div>
  )
}
