import React, { createContext, useContext, useEffect, useState } from 'react'

type Theme = 'light' | 'dark' | 'gray'

interface ThemeContextType {
  theme: Theme
  setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider')
  }
  return context
}

interface ThemeProviderProps {
  children: React.ReactNode
  defaultTheme?: Theme
}

export function ThemeProvider({ children, defaultTheme = 'light' }: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(() => {
    // Check localStorage first
    const savedTheme = localStorage.getItem('browseros-theme') as Theme
    if (savedTheme && ['light', 'dark', 'gray'].includes(savedTheme)) {
      return savedTheme
    }
    // Check system preference
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark'
    }
    return defaultTheme
  })

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme)
    localStorage.setItem('browseros-theme', newTheme)

    // Update HTML attributes
    document.documentElement.setAttribute('data-theme', newTheme)

    // Remove all theme classes first
    document.documentElement.classList.remove('dark', 'gray')

    // Add the appropriate class for dark/gray themes
    if (newTheme === 'dark' || newTheme === 'gray') {
      document.documentElement.classList.add(newTheme)
    }

    // Dispatch custom event for other components to listen
    window.dispatchEvent(new CustomEvent('theme-change', { detail: newTheme }))
  }

  useEffect(() => {
    // Apply theme on mount
    document.documentElement.setAttribute('data-theme', theme)
    document.documentElement.classList.remove('dark', 'gray')
    if (theme === 'dark' || theme === 'gray') {
      document.documentElement.classList.add(theme)
    }

    // Listen for system theme changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = (e: MediaQueryListEvent) => {
      // Only auto-switch if no saved preference
      if (!localStorage.getItem('browseros-theme')) {
        setTheme(e.matches ? 'dark' : 'light')
      }
    }

    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}