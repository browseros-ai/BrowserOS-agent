import { createContext, useContext, useEffect, useState } from 'react'
import { type Theme, themeStorage } from '@/lib/theme/theme-storage'

type ThemeProviderProps = {
  children: React.ReactNode
  defaultTheme?: Theme
}

type ThemeProviderState = {
  theme: Theme
  setTheme: (theme: Theme) => void
}

const initialState: ThemeProviderState = {
  theme: 'system',
  setTheme: () => null,
}

const ThemeProviderContext = createContext<ThemeProviderState>(initialState)

/**
 * @public
 */
export function ThemeProvider({
  children,
  defaultTheme = 'system',
  ...props
}: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(defaultTheme)

  useEffect(() => {
    themeStorage.getValue().then((savedTheme) => {
      if (savedTheme) {
        setThemeState(savedTheme)
      }
    })

    const unwatch = themeStorage.watch((newTheme) => {
      if (newTheme) {
        setThemeState(newTheme)
      }
    })

    return () => unwatch()
  }, [])

  useEffect(() => {
    const root = window.document.documentElement

    const applyTheme = (targetTheme: 'dark' | 'light') => {
      const oppositeTheme = targetTheme === 'dark' ? 'light' : 'dark'

      if (root.classList.contains(oppositeTheme)) {
        root.classList.remove(oppositeTheme)
      }
      if (!root.classList.contains(targetTheme)) {
        root.classList.add(targetTheme)
      }
    }

    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')

      const applySystemTheme = () => {
        const systemTheme = mediaQuery.matches ? 'dark' : 'light'
        applyTheme(systemTheme)
      }

      applySystemTheme()

      mediaQuery.addEventListener('change', applySystemTheme)

      return () => {
        mediaQuery.removeEventListener('change', applySystemTheme)
      }
    }

    applyTheme(theme)
  }, [theme])

  const value = {
    theme,
    setTheme: (newTheme: Theme) => {
      themeStorage.setValue(newTheme)
      setThemeState(newTheme)
    },
  }

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  )
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext)

  if (context === undefined)
    throw new Error('useTheme must be used within a ThemeProvider')

  return context
}
