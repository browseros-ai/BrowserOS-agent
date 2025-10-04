import React, { useState, useEffect } from 'react'
import { useTheme } from './ThemeProvider'
import {
  Bot, Settings, KeyRound, Shield, Zap, Palette, Search,
  Chrome, Power, Languages, Download, Accessibility, Monitor,
  RotateCcw, Menu, X, Moon, Sun, Cloud
} from 'lucide-react'

interface SidebarItem {
  id: string
  label: string
  icon: React.ElementType
  disabled?: boolean
}

const sidebarItems: SidebarItem[] = [
  { id: 'browseros-ai', label: 'BrowserOS AI', icon: Bot },
  { id: 'browseros-settings', label: 'BrowserOS Settings', icon: Settings, disabled: true },
  { id: 'autofill', label: 'Autofill and passwords', icon: KeyRound, disabled: true },
  { id: 'privacy', label: 'Privacy and security', icon: Shield, disabled: true },
  { id: 'performance', label: 'Performance', icon: Zap, disabled: true },
  { id: 'ai-innovations', label: 'AI innovations', icon: Bot, disabled: true },
  { id: 'appearance', label: 'Appearance', icon: Palette, disabled: true },
  { id: 'search', label: 'Search engine', icon: Search, disabled: true },
  { id: 'browser', label: 'Default browser', icon: Chrome, disabled: true },
  { id: 'startup', label: 'On startup', icon: Power, disabled: true },
  { id: 'languages', label: 'Languages', icon: Languages, disabled: true },
  { id: 'downloads', label: 'Downloads', icon: Download, disabled: true },
  { id: 'accessibility', label: 'Accessibility', icon: Accessibility, disabled: true },
  { id: 'system', label: 'System', icon: Monitor, disabled: true },
  { id: 'reset', label: 'Reset settings', icon: RotateCcw, disabled: true }
]

interface SettingsLayoutProps {
  children: React.ReactNode
}

export function SettingsLayout({ children }: SettingsLayoutProps) {
  const { theme, setTheme } = useTheme()
  const [activeSection, setActiveSection] = useState('browseros-ai')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // Close sidebar on larger screens
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setSidebarOpen(false)
      }
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const handleSectionClick = (sectionId: string, disabled?: boolean) => {
    if (!disabled) {
      setActiveSection(sectionId)
      setSidebarOpen(false) // Close on mobile after selection
    }
  }

  const getThemeIcon = () => {
    switch (theme) {
      case 'dark':
        return <Moon className="w-5 h-5" />
      case 'gray':
        return <Cloud className="w-5 h-5" />
      default:
        return <Sun className="w-5 h-5" />
    }
  }

  const cycleTheme = () => {
    const themes: Array<'light' | 'dark' | 'gray'> = ['light', 'dark', 'gray']
    const currentIndex = themes.indexOf(theme)
    const nextIndex = (currentIndex + 1) % themes.length
    setTheme(themes[nextIndex])
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          settings-sidebar fixed md:relative w-[272px] h-full z-30 md:z-auto
          transform transition-transform md:transform-none
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
      >
        <div className="flex flex-col h-full">
          {/* Sidebar Header - Mobile only */}
          <div className="flex md:hidden items-center justify-between p-4 border-b border-border">
            <h2 className="text-lg font-semibold">Settings</h2>
            <button
              onClick={() => setSidebarOpen(false)}
              className="p-1 hover:bg-accent rounded-md transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Sidebar Items */}
          <div className="flex-1 overflow-y-auto pt-2">
            {sidebarItems.map((item) => {
              const Icon = item.icon
              return (
                <div
                  key={item.id}
                  className={`
                    settings-sidebar-item
                    ${activeSection === item.id ? 'active' : ''}
                    ${item.disabled ? 'opacity-50 cursor-not-allowed' : ''}
                  `}
                  onClick={() => handleSectionClick(item.id, item.disabled)}
                >
                  <Icon
                    className="absolute left-5 w-5 h-5 flex-shrink-0"
                    style={{ strokeWidth: 1.5 }}
                  />
                  <span>{item.label}</span>
                </div>
              )
            })}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="settings-header h-14 flex items-center px-6 border-b border-border">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-4">
              {/* Mobile menu button */}
              <button
                onClick={() => setSidebarOpen(true)}
                className="p-2 hover:bg-accent rounded-md transition-colors md:hidden"
              >
                <Menu className="w-5 h-5" />
              </button>

              {/* Title */}
              <h1 className="text-[20px] font-normal">Settings</h1>
            </div>

            <div className="flex items-center gap-4">
              {/* Search */}
              <div className="relative hidden md:block">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search settings"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="settings-search w-64 lg:w-80"
                />
              </div>

              {/* Theme Toggle */}
              <button
                onClick={cycleTheme}
                className="p-2 hover:bg-accent rounded-md transition-colors"
                title={`Current theme: ${theme}`}
              >
                {getThemeIcon()}
              </button>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-[696px] mx-auto px-6 py-8">
            {children}
          </div>
        </div>
      </main>
    </div>
  )
}