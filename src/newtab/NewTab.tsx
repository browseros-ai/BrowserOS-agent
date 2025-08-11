import React, { useEffect } from 'react'
import { CommandInput } from './components/CommandInput'
import { ThemeToggle } from './components/ThemeToggle'
import { useSettingsStore } from '@/sidepanel/v2/stores/settingsStore'

export function NewTab() {
  const { theme, fontSize } = useSettingsStore()
  
  // Apply theme and font size
  useEffect(() => {
    document.documentElement.style.setProperty('--app-font-size', `${fontSize}px`)
    const root = document.documentElement
    root.classList.remove('dark', 'gray')
    if (theme === 'dark') root.classList.add('dark')
    if (theme === 'gray') root.classList.add('gray')
  }, [theme, fontSize])
  
  
  return (
    <div className="min-h-screen bg-background relative">
      {/* Theme Toggle - Top Right */}
      <div className="absolute top-6 right-6 z-10">
        <ThemeToggle />
      </div>
      
      {/* Main Content - Centered (slightly above center for better visual balance) */}
      <div className="min-h-screen flex items-center justify-center">
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
          <CommandInput />
        </div>
      </div>
    </div>
  )
}