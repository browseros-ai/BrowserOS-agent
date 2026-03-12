import {
  ArrowLeft,
  Bot,
  Compass,
  Info,
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

const settingsNavSections: NavSection[] = [
  {
    label: 'Provider Settings',
    items: [
      { name: 'LLM Providers', to: '/settings/ai', icon: Bot },
      {
        name: 'Chat & Hub Provider',
        to: '/settings/chat',
        icon: MessageSquare,
      },
      { name: 'Search Provider', to: '/settings/search', icon: Search },
    ],
  },
  {
    label: 'BrowserOS Features',
    items: [
      { name: 'BrowserOS as MCP', to: '/settings/mcp', icon: Server },
      {
        name: 'Customization',
        to: '/settings/customization',
        icon: Palette,
        feature: Feature.CUSTOMIZATION_SUPPORT,
      },
    ],
  },
  {
    label: 'Misc',
    items: [
      { name: 'Explore Features', to: '/onboarding/features', icon: Compass },
      { name: 'Revisit Onboarding', to: '/onboarding', icon: RotateCcw },
    ],
  },
]

export const SettingsSidebar: FC = () => {
  const location = useLocation()
  const { supports } = useCapabilities()

  const filteredSections = settingsNavSections
    .map((section) => ({
      ...section,
      items: section.items.filter(
        (item) => !item.feature || supports(item.feature),
      ),
    }))
    .filter((section) => section.items.length > 0)

  const getNavLinkClassName = (isActive: boolean) =>
    cn(
      'flex h-9 items-center gap-2 overflow-hidden whitespace-nowrap rounded-md px-3 font-medium text-sm transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
      isActive && 'bg-sidebar-accent text-sidebar-accent-foreground',
    )

  const getSectionClassName = (index: number) =>
    cn(index > 0 && 'mt-3 border-t pt-3')

  const sectionLabelClassName =
    'mb-2 px-3 font-semibold text-[10px] text-muted-foreground uppercase tracking-[0.18em]'

  const isActivePath = (path: string) => location.pathname === path

  const renderNavItem = (item: NavItem) => {
    const Icon = item.icon
    const isActive = isActivePath(item.to)

    return (
      <NavLink
        key={item.to}
        to={item.to}
        className={getNavLinkClassName(isActive)}
      >
        <Icon className="size-4 shrink-0" />
        <span className="truncate">{item.name}</span>
      </NavLink>
    )
  }

  const renderSection = (section: NavSection, index: number) => (
    <div key={section.label} className={getSectionClassName(index)}>
      <div className={sectionLabelClassName}>{section.label}</div>
      <nav className="space-y-1">{section.items.map(renderNavItem)}</nav>
    </div>
  )

  return (
    <div className="flex h-full w-64 flex-col border-r bg-sidebar text-sidebar-foreground">
      <div className="flex h-14 items-center justify-between border-b px-2">
        <NavLink
          to="/home"
          className="flex h-9 items-center gap-2 overflow-hidden whitespace-nowrap rounded-md px-3 font-medium text-sm transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        >
          <ArrowLeft className="size-4 shrink-0" />
          <span className="truncate">Back</span>
        </NavLink>
        <ThemeToggle
          className="mr-1 h-8 w-8 shrink-0"
          iconClassName="h-4 w-4"
        />
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden p-2">
        <div className="mb-2 px-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">
          Settings
        </div>
        <div>{filteredSections.map(renderSection)}</div>
      </div>

      <div className="mt-auto border-t p-2">
        <a
          href="https://docs.browseros.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-9 items-center gap-2 overflow-hidden whitespace-nowrap rounded-md px-3 font-medium text-sm transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        >
          <Info className="size-4 shrink-0" />
          <span className="truncate">About BrowserOS</span>
        </a>
      </div>
    </div>
  )
}
