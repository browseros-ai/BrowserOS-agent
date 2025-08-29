import React, { useEffect, useState } from 'react'
import { CommandInput } from './components/CommandInput'
import { ThemeToggle } from './components/ThemeToggle'
import { SettingsDialog } from './components/SettingsDialog'
import { CreateAgentPage } from './pages/CreateAgentPage'
import { UserAgentsSection } from './components/UserAgentsSection'
import { useSettingsStore } from '@/sidepanel/stores/settingsStore'
import { useAgentsStore } from './stores/agentsStore'
import { Settings } from 'lucide-react'

export function NewTab() {
  const { theme, fontSize } = useSettingsStore()
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [currentView, setCurrentView] = useState<'main' | 'create-agent'>('main')
  const { loadAgents } = useAgentsStore()
  
  // Load agents from storage on mount
  useEffect(() => {
    // Load agents from storage
    chrome.storage.local.get('agents', (result) => {
      if (result.agents) {
        loadAgents(result.agents)
      }
    })
  }, [loadAgents])
  
  // Apply theme and font size
  useEffect(() => {
    document.documentElement.style.setProperty('--app-font-size', `${fontSize}px`)
    const root = document.documentElement
    root.classList.remove('dark', 'gray')
    if (theme === 'dark') root.classList.add('dark')
    if (theme === 'gray') root.classList.add('gray')
  }, [theme, fontSize])
  
  // Render create agent page if view is set
  if (currentView === 'create-agent') {
    return <CreateAgentPage onBack={() => setCurrentView('main')} />
  }
  
  
  return (
    <div className="min-h-screen bg-background relative">
      {/* Top Right Controls - Settings and Theme Toggle */}
      <div className="absolute top-6 right-6 z-10 flex items-center gap-2">
        {/* Settings Button */}
        <button
          type="button"
          className="
            p-2 rounded-full 
            transition-colors duration-200 ease-in-out 
            focus:outline-none focus:ring-2 focus:ring-offset-2 
            focus:ring-offset-white dark:focus:ring-offset-gray-900 
            focus:ring-gray-400 
            text-gray-600 dark:text-gray-300
            hover:bg-gray-100 dark:hover:bg-gray-800
          "
          aria-label="Settings"
          onClick={() => setIsSettingsOpen(true)}
        >
          <Settings size={20} className="transition-transform duration-200" />
        </button>
        
        {/* Theme Toggle */}
        <ThemeToggle />
      </div>
      
      {/* Main Content - Centered (slightly above center for better visual balance) */}
      <div className="min-h-screen flex flex-col items-center justify-center">
        <div className="w-full max-w-3xl px-4 -mt-20">
          {/* BrowserOS Branding */}
          <div className="flex items-center justify-center mb-10">
            <img 
              src="/assets/browseros.svg" 
              alt="BrowserOS" 
              className="w-12 h-12 mr-3"
            />
            <span className="text-4xl font-light text-foreground tracking-tight">
              BrowserOS
            </span>
          </div>
          
          {/* Command Input - Clean and Centered */}
          <CommandInput onCreateAgent={() => setCurrentView('create-agent')} />
        </div>
        
        {/* User Agents Section - Shows up to 4 random agents */}
        <UserAgentsSection onEditAgent={() => setCurrentView('create-agent')} />
      </div>
      
      {/* Settings Dialog */}
      <SettingsDialog 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
      />
    </div>
  )
}