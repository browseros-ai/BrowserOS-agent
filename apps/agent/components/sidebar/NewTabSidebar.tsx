import {
  CalendarClock,
  GitBranch,
  Keyboard,
  type LucideIcon,
  Settings,
  UserPen,
} from 'lucide-react'
import type { FC } from 'react'
import { NavLink, useLocation } from 'react-router'
import ProductLogoSvg from '@/assets/product_logo.svg'
import { ThemeToggle } from '@/components/elements/theme-toggle'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import { Feature } from '@/lib/browseros/capabilities'
import { useCapabilities } from '@/lib/browseros/useCapabilities'
import { cn } from '@/lib/utils'

interface NavItem {
  name: string
  icon: LucideIcon
  href?: string
  to?: string
  feature?: Feature
  action?: 'openShortcuts'
}

const navItems: NavItem[] = [
  {
    name: 'Workflows',
    icon: GitBranch,
    href: '/options.html#/workflows',
  },
  {
    name: 'Scheduled',
    icon: CalendarClock,
    href: '/options.html#/scheduled',
  },
  {
    name: 'Personalize',
    icon: UserPen,
    to: '/personalize',
    feature: Feature.PERSONALIZATION_SUPPORT,
  },
  {
    name: 'Shortcuts',
    icon: Keyboard,
    action: 'openShortcuts',
  },
]

interface NewTabSidebarProps {
  onOpenShortcuts?: () => void
}

export const NewTabSidebar: FC<NewTabSidebarProps> = ({ onOpenShortcuts }) => {
  const location = useLocation()
  const { supports } = useCapabilities()

  const isActive = (item: NavItem) => {
    if (item.to) return location.pathname === item.to
    return false
  }

  const renderNavItem = (item: NavItem) => {
    const Icon = item.icon
    const active = isActive(item)

    const buttonClasses = cn(
      'flex h-auto w-full flex-col items-center gap-1 rounded-lg px-2 py-2.5',
      'text-muted-foreground hover:bg-accent hover:text-foreground',
      active && 'bg-[var(--accent-orange)]/10 text-[var(--accent-orange)]',
    )

    const content = (
      <>
        <Icon className="size-5 shrink-0" />
        <span className="font-medium text-[11px] leading-tight">
          {item.name}
        </span>
      </>
    )

    if (item.action === 'openShortcuts') {
      return (
        <SidebarMenuItem key={item.name}>
          <SidebarMenuButton asChild className={buttonClasses}>
            <button type="button" onClick={onOpenShortcuts}>
              {content}
            </button>
          </SidebarMenuButton>
        </SidebarMenuItem>
      )
    }

    if (item.href) {
      return (
        <SidebarMenuItem key={item.name}>
          <SidebarMenuButton asChild className={buttonClasses}>
            <a href={item.href}>{content}</a>
          </SidebarMenuButton>
        </SidebarMenuItem>
      )
    }

    if (!item.to) return null

    return (
      <SidebarMenuItem key={item.name}>
        <SidebarMenuButton asChild className={buttonClasses}>
          <NavLink to={item.to}>{content}</NavLink>
        </SidebarMenuButton>
      </SidebarMenuItem>
    )
  }

  return (
    <Sidebar
      collapsible="none"
      className="h-screen shrink-0 border-border border-r"
    >
      <SidebarHeader className="flex items-center justify-center px-2 pt-3 pb-1">
        <a
          href="/newtab.html"
          className="flex size-10 items-center justify-center rounded-xl transition-transform hover:scale-105"
          aria-label="BrowserOS home"
        >
          <img src={ProductLogoSvg} alt="BrowserOS" className="size-8" />
        </a>
      </SidebarHeader>

      <SidebarContent className="px-2 pt-2">
        <SidebarMenu className="gap-1">
          {navItems
            .filter((item) => !item.feature || supports(item.feature))
            .map(renderNavItem)}

          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="flex h-auto w-full flex-col items-center gap-1 rounded-lg px-2 py-2.5 text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <div>
                <ThemeToggle
                  className="size-5 p-0 hover:bg-transparent"
                  iconClassName="size-5"
                />
                <span className="font-medium text-[11px] leading-tight">
                  Theme
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarContent>

      <SidebarFooter className="mt-auto px-2 pb-4">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="flex h-auto w-full flex-col items-center gap-1 rounded-lg px-2 py-2.5 text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <a href="/options.html" aria-label="Open settings">
                <Settings className="size-5 shrink-0" />
                <span className="font-medium text-[11px] leading-tight">
                  Settings
                </span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
