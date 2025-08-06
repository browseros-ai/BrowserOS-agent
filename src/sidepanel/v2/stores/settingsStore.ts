import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { z } from 'zod'

// Settings schema
const SettingsSchema = z.object({
  fontSize: z.number().min(12).max(24).default(14),  // Font size in pixels
  isDarkMode: z.boolean().default(false)  // Dark mode setting
})

type Settings = z.infer<typeof SettingsSchema>

// Store actions
interface SettingsActions {
  setFontSize: (size: number) => void
  setDarkMode: (isDark: boolean) => void
  resetSettings: () => void
}

// Initial state
const initialState: Settings = {
  fontSize: 14,
  isDarkMode: false
}

// Create the store with persistence
export const useSettingsStore = create<Settings & SettingsActions>()(
  persist(
    (set) => ({
      // State
      ...initialState,
      
      // Actions
      setFontSize: (size) => {
        set({ fontSize: size })
        // Apply font size to document
        document.documentElement.style.setProperty('--app-font-size', `${size}px`)
      },
      
      setDarkMode: (isDark) => {
        set({ isDarkMode: isDark })
        // Apply dark mode to document
        if (isDark) {
          document.documentElement.classList.add('dark')
        } else {
          document.documentElement.classList.remove('dark')
        }
      },
      
      resetSettings: () => {
        set(initialState)
        // Reset document styles
        document.documentElement.style.removeProperty('--app-font-size')
        document.documentElement.classList.remove('dark')
      }
    }),
    {
      name: 'nxtscape-settings',  // localStorage key
      version: 1
    }
  )
) 