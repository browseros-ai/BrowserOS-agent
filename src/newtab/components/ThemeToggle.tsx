import React from 'react'
import { SunIcon, MoonIcon } from 'lucide-react'
import { useSettingsStore } from '@/sidepanel/stores/settingsStore'

export function ThemeToggle() {
  const { theme, setTheme } = useSettingsStore()
  
  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : theme === 'dark' ? 'light' : 'light'
    setTheme(newTheme)
  }
  
  return (
    <button
      onClick={toggleTheme}
      className="
        p-2 rounded-full 
        transition-colors duration-200 ease-in-out 
        focus:outline-none focus:ring-2 focus:ring-offset-2 
        focus:ring-offset-white dark:focus:ring-offset-gray-900 
        focus:ring-gray-400 
        text-gray-600 dark:text-gray-300
        hover:bg-gray-100 dark:hover:bg-gray-800
      "
      aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
    >
      {theme === 'light' ? (
        <MoonIcon size={20} className="transition-transform duration-200" />
      ) : (
        <SunIcon size={20} className="transition-transform duration-200" />
      )}
    </button>
  )
}