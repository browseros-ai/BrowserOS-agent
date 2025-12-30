import {
  Bot,
  Info,
  type LucideIcon,
  Menu,
  MessageSquare,
  PlugZap,
  RotateCcw,
  Search,
  Server,
  X,
} from 'lucide-react'
import type { FC, HTMLAttributeAnchorTarget } from 'react'
import { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router'
import { ThemeToggle } from '@/components/elements/theme-toggle'
import { Feature } from '@/lib/browseros/capabilities'
import { useCapabilities } from '@/lib/browseros/useCapabilities'

type NavItem = {
  name: string
  to: string
  icon: LucideIcon
  enabled: boolean
  target?: HTMLAttributeAnchorTarget
  feature?: Feature
}

const navigationItems: NavItem[] = [
  {
    name: 'BrowserOS AI',
    to: '/ai',
    icon: Bot,
    enabled: true,
  },
  {
    name: 'LLM Chat & Hub',
    to: '/chat',
    icon: MessageSquare,
    enabled: true,
  },
  {
    name: 'Search Engines',
    to: '/search',
    icon: Search,
    enabled: false,
  },
  {
    name: 'Connect with MCP',
    to: '/connect-mcp',
    icon: PlugZap,
    enabled: true,
    feature: Feature.MANAGED_MCP_SUPPORT,
  },
  {
    name: 'BrowserOS MCP',
    to: '/mcp',
    icon: Server,
    enabled: true,
  },
  {
    name: 'Revisit Onboarding',
    to: chrome.runtime.getURL('onboarding.html'),
    icon: RotateCcw,
    target: '_blank',
    enabled: true,
  },
]

/**
 * @public
 */
export const DashboardLayout: FC = () => {
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { supports } = useCapabilities()
  return (
    <div className="min-h-screen bg-background">
      {/* Mobile Header */}
      <div className="sticky top-0 z-40 flex items-center justify-between border-border border-b bg-background px-4 py-3 lg:hidden">
        <h1 className="font-semibold text-lg">Settings</h1>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="rounded-lg p-2 transition-colors hover:bg-accent"
            aria-label="Toggle menu"
          >
            {sidebarOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        // biome-ignore lint/a11y/useSemanticElements: overlay cannot be a button element
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close sidebar"
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              setSidebarOpen(false)
            }
          }}
        />
      )}

      <div className="flex">
        {/* Sidebar */}
        <aside
          className={`fixed inset-y-0 left-0 z-50 w-64 transform border-border border-r bg-background transition-transform duration-300 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="flex h-full flex-col">
            {/* Sidebar Header */}
            <div className="flex items-center justify-between border-border border-b px-6 py-4">
              <h1 className="font-semibold text-xl">Settings</h1>
              <ThemeToggle />
            </div>

            {/* Navigation */}
            <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
              {navigationItems
                .filter(
                  (item) =>
                    item.enabled && (!item.feature || supports(item.feature)),
                )
                .map((item) => {
                  const isActive = location.pathname === item.to
                  const Icon = item.icon
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      onClick={() => setSidebarOpen(false)}
                      target={item.target}
                      rel={item.target ? 'noopener noreferrer' : undefined}
                      className={`flex items-center gap-3 rounded-lg px-3 py-2.5 font-medium text-sm transition-all ${
                        isActive
                          ? 'bg-accent text-accent-foreground shadow-sm'
                          : 'text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground'
                      }`}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span>{item.name}</span>
                    </NavLink>
                  )
                })}
            </nav>

            {/* Footer - TODO: Add link back when About page is ready */}
            <div className="border-border border-t px-3 py-4">
              <a
                href="https://docs.browseros.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 font-medium text-muted-foreground text-sm transition-colors hover:bg-accent/50 hover:text-accent-foreground"
              >
                <Info className="h-4 w-4 shrink-0" />
                <span>About BrowserOS</span>
              </a>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-5xl overflow-hidden px-4 py-8 sm:px-6 lg:px-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
