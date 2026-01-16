import {
  CalendarClock,
  GitBranch,
  type LucideIcon,
  Settings,
  UserPen,
} from 'lucide-react'
import type { FC } from 'react'
import { NavLink, useLocation } from 'react-router'
import ProductLogoSvg from '@/assets/product_logo.svg'
import { ThemeToggle } from '@/components/elements/theme-toggle'
import { Feature } from '@/lib/browseros/capabilities'
import { useCapabilities } from '@/lib/browseros/useCapabilities'
import { cn } from '@/lib/utils'

interface NavItem {
  name: string
  icon: LucideIcon
  href?: string
  to?: string
  feature?: Feature
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
]

export const NewTabSidebar: FC = () => {
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
      'relative flex h-10 w-full items-center gap-3 rounded-lg px-3',
      'text-muted-foreground hover:bg-accent hover:text-foreground',
      'transition-colors duration-150',
      active && 'text-[var(--accent-orange)]',
    )

    const content = (
      <>
        {active && (
          <span className="absolute left-0 h-6 w-1 rounded-r-full bg-[var(--accent-orange)]" />
        )}
        <Icon className="size-5 shrink-0" />
        <span className="truncate font-medium text-sm opacity-0 transition-opacity duration-200 group-hover:opacity-100">
          {item.name}
        </span>
      </>
    )

    if (item.href) {
      return (
        <li key={item.name}>
          <a href={item.href} className={buttonClasses}>
            {content}
          </a>
        </li>
      )
    }

    if (!item.to) return null

    return (
      <li key={item.name}>
        <NavLink to={item.to} className={buttonClasses}>
          {content}
        </NavLink>
      </li>
    )
  }

  return (
    <aside
      className={cn(
        'group fixed inset-y-0 left-0 z-40 flex h-screen flex-col',
        'w-14 hover:w-40',
        'border-border border-r bg-background',
        'transition-[width] duration-200 ease-out',
      )}
    >
      {/* Logo */}
      <div className="flex items-center px-2 pt-3 pb-2">
        <a
          href="/newtab.html"
          className="flex size-10 items-center justify-center rounded-xl transition-transform hover:scale-105"
          aria-label="BrowserOS home"
        >
          <img src={ProductLogoSvg} alt="BrowserOS" className="size-8" />
        </a>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 pt-2">
        <ul className="flex flex-col gap-1">
          {navItems
            .filter((item) => !item.feature || supports(item.feature))
            .map(renderNavItem)}
        </ul>
      </nav>

      {/* Footer - Theme & Settings */}
      <div className="mt-auto flex flex-col gap-1 px-2 pb-4">
        {/* Theme toggle */}
        <div
          className={cn(
            'relative flex h-10 w-full items-center gap-3 rounded-lg px-3',
            'text-muted-foreground hover:bg-accent hover:text-foreground',
            'transition-colors duration-150',
          )}
        >
          <ThemeToggle
            className="size-5 shrink-0 p-0 hover:bg-transparent"
            iconClassName="size-5"
            dropdownSide="right"
            dropdownAlign="end"
          />
          <span className="truncate font-medium text-sm opacity-0 transition-opacity duration-200 group-hover:opacity-100">
            Theme
          </span>
        </div>

        {/* Settings */}
        <a
          href="/options.html"
          className={cn(
            'relative flex h-10 w-full items-center gap-3 rounded-lg px-3',
            'text-muted-foreground hover:bg-accent hover:text-foreground',
            'transition-colors duration-150',
          )}
          aria-label="Open settings"
        >
          <Settings className="size-5 shrink-0" />
          <span className="truncate font-medium text-sm opacity-0 transition-opacity duration-200 group-hover:opacity-100">
            Settings
          </span>
        </a>
      </div>
    </aside>
  )
}
