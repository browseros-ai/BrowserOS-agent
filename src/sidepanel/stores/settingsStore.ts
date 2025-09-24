import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { z } from 'zod'

// Settings schema
const SettingsSchema = z.object({
  fontSize: z.number().min(13).max(21).default(16),  // Font size in pixels
  theme: z.enum(['light', 'dark', 'gray']).default('light'),  // App theme
  autoScroll: z.boolean().default(true),  // Auto-scroll chat to bottom
  autoCollapseTools: z.boolean().default(false),  // Auto-collapse tool results
  chatMode: z.boolean().default(false),  // Legacy: Chat mode for Q&A (kept for backwards compatibility)
  appMode: z.enum(['chat', 'agent', 'teach']).default('agent')  // Current app mode
})

type Settings = z.infer<typeof SettingsSchema>

// Store actions
interface SettingsActions {
  setFontSize: (size: number) => void
  setTheme: (theme: 'light' | 'dark' | 'gray') => void
  setAutoScroll: (enabled: boolean) => void
  setAutoCollapseTools: (enabled: boolean) => void
  setChatMode: (enabled: boolean) => void
  setAppMode: (mode: 'chat' | 'agent' | 'teach') => void
  resetSettings: () => void
}

// Initial state
const initialState: Settings = {
  fontSize: 16,
  theme: 'light',
  autoScroll: true,
  autoCollapseTools: false,
  chatMode: false,
  appMode: 'agent'
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
      
      setTheme: (theme) => {
        set({ theme })
        // Apply theme classes to document
        const root = document.documentElement
        root.classList.remove('dark')
        root.classList.remove('gray')
        if (theme === 'dark') root.classList.add('dark')
        if (theme === 'gray') root.classList.add('gray')
      },
      
      setAutoScroll: (enabled) => {
        set({ autoScroll: enabled })
      },
      
      setAutoCollapseTools: (enabled) => {
        set({ autoCollapseTools: enabled })
      },
      
      setChatMode: (enabled) => {
        set({ chatMode: enabled })
      },

      setAppMode: (mode) => {
        set({
          appMode: mode,
          // Update legacy chatMode for backwards compatibility
          chatMode: mode === 'chat'
        })
      },

      resetSettings: () => {
        set(initialState)
        // Reset document styles
        document.documentElement.style.removeProperty('--app-font-size')
        document.documentElement.classList.remove('dark')
        document.documentElement.classList.remove('gray')
      }
    }),
    {
      name: 'nxtscape-settings',  // localStorage key
      version: 5,
      migrate: (persisted: any, version: number) => {
        // Migrate from v1 isDarkMode -> theme
        if (version === 1 && persisted) {
          const isDarkMode: boolean = persisted.isDarkMode === true
          const next = {
            fontSize: typeof persisted.fontSize === 'number' ? persisted.fontSize : 16,
            theme: isDarkMode ? 'dark' : 'light'
          }
          return next
        }
        // Migrate to v3 add autoScroll default true
        if (version === 2 && persisted) {
          return {
            fontSize: typeof persisted.fontSize === 'number' ? persisted.fontSize : 16,
            theme: persisted.theme === 'dark' || persisted.theme === 'gray' ? persisted.theme : 'light',
            autoScroll: true
          } as Settings
        }
        // Migrate to v4 add autoCollapseTools default false
        if (version === 3 && persisted) {
          return {
            fontSize: typeof persisted.fontSize === 'number' ? persisted.fontSize : 16,
            theme: persisted.theme === 'dark' || persisted.theme === 'gray' ? persisted.theme : 'light',
            autoScroll: typeof persisted.autoScroll === 'boolean' ? persisted.autoScroll : true,
            autoCollapseTools: false,
            chatMode: false
          } as Settings
        }
        // Migrate to v5 add chatMode default false
        if (version === 4 && persisted) {
          return {
            fontSize: typeof persisted.fontSize === 'number' ? persisted.fontSize : 16,
            theme: persisted.theme === 'dark' || persisted.theme === 'gray' ? persisted.theme : 'light',
            autoScroll: typeof persisted.autoScroll === 'boolean' ? persisted.autoScroll : true,
            autoCollapseTools: typeof persisted.autoCollapseTools === 'boolean' ? persisted.autoCollapseTools : false,
            chatMode: false
          } as Settings
        }
        return persisted as Settings
      }
    }
  )
) 
