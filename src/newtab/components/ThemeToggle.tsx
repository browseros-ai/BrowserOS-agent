import React from 'react'
import { SunIcon, MoonIcon, MonitorIcon } from 'lucide-react'
import { useSettingsStore } from '@/sidepanel/stores/settingsStore'

export function ThemeToggle() {
  const { theme, setTheme } = useSettingsStore()

  const toggleTheme = () => {
    // Cycle through: light -> dark -> gray -> light
    const newTheme = theme === 'light' ? 'dark' : theme === 'dark' ? 'gray' : 'light'
    setTheme(newTheme)
  }

  const getNextTheme = () => {
    return theme === 'light' ? 'dark' : theme === 'dark' ? 'gray' : 'light'
  }

  const getIcon = () => {
    switch (theme) {
      case 'light':
        return <MoonIcon size={20} className="transition-transform duration-200" />
      case 'dark':
        return <MonitorIcon size={20} className="transition-transform duration-200" />
      case 'gray':
        return <SunIcon size={20} className="transition-transform duration-200" />
      default:
        return <SunIcon size={20} className="transition-transform duration-200" />
    }
  }

  return (
    <button
      onClick={toggleTheme}
      className="
        p-2 rounded-full
        transition-colors duration-200 ease-in-out
        focus:outline-none focus:ring-2 focus:ring-offset-2
        focus:ring-offset-white dark:focus:ring-offset-gray-900 gray:focus:ring-offset-gray-800
        focus:ring-gray-400
        text-gray-600 dark:text-gray-300 gray:text-gray-400
        hover:bg-gray-100 dark:hover:bg-gray-800 gray:hover:bg-gray-700
      "
      aria-label={`Switch to ${getNextTheme()} mode`}
    >
      {getIcon()}
    </button>
  )
}