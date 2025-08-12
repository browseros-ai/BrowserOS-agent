import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { z } from 'zod'

// Defaults
const DEFAULT_AUTO_COLLAPSE_DELAY_MS = 10000  // Default auto-collapse delay
const MAX_AUTO_COLLAPSE_DELAY_MS = 30000  // User cap: 30 seconds

// Settings schema
const SettingsSchema = z.object({
  fontSize: z.number().min(13).max(21).default(14),  // Font size in pixels
  theme: z.enum(['light', 'dark', 'gray']).default('light'),  // App theme
  autoScroll: z.boolean().default(true),  // Auto-scroll chat to bottom
  autoCollapseDelayMs: z.number().int().nonnegative().default(DEFAULT_AUTO_COLLAPSE_DELAY_MS),  // Auto-collapse delay
  showPdfPreview: z.boolean().default(true),  // Show PDF page preview alongside extracted items
  autoCollapseKeys: z.array(z.string()).default([])  // Per-dropdown keys that should auto-collapse; empty means all
})

type Settings = z.infer<typeof SettingsSchema>

// Store actions
interface SettingsActions {
  setFontSize: (size: number) => void
  setTheme: (theme: 'light' | 'dark' | 'gray') => void
  setAutoScroll: (enabled: boolean) => void
  setAutoCollapseDelayMs: (delayMs: number) => void
  setShowPdfPreview: (enabled: boolean) => void
  setAutoCollapseKey: (key: string, enabled: boolean) => void
  setAutoCollapseKeys: (keys: string[]) => void
  isAutoCollapseEnabledFor: (key: string | undefined) => boolean
  resetSettings: () => void
}

// Initial state
const initialState: Settings = {
  fontSize: 14,
  theme: 'light',
  autoScroll: true,
  autoCollapseDelayMs: DEFAULT_AUTO_COLLAPSE_DELAY_MS,
  showPdfPreview: true,
  autoCollapseKeys: []
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
      
      setAutoCollapseDelayMs: (delayMs) => {
        const clamped = Math.min(MAX_AUTO_COLLAPSE_DELAY_MS, Math.max(0, Math.floor(delayMs)))
        set({ autoCollapseDelayMs: clamped })
      },
      
      setShowPdfPreview: (enabled) => {
        set({ showPdfPreview: enabled })
      },

      setAutoCollapseKey: (key, enabled) => {
        set((state) => {
          const current = state.autoCollapseKeys || []
          const exists = current.includes(key)
          if (enabled && !exists) return { autoCollapseKeys: [...current, key] }
          if (!enabled && exists) return { autoCollapseKeys: current.filter(k => k !== key) }
          return {}
        })
      },

      setAutoCollapseKeys: (keys) => set({ autoCollapseKeys: [...new Set(keys)] }),

      isAutoCollapseEnabledFor: (key) => {
        const { autoCollapseDelayMs, autoCollapseKeys } = (useSettingsStore as any).getState() as Settings
        if (!key) return autoCollapseDelayMs > 0 && (autoCollapseKeys.length === 0)
        return autoCollapseDelayMs > 0 && (autoCollapseKeys.length === 0 || autoCollapseKeys.includes(key))
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
      version: 7,
      migrate: (persisted: any, version: number) => {
        // Migrate from v1 isDarkMode -> theme
        if (version === 1 && persisted) {
          const isDarkMode: boolean = persisted.isDarkMode === true
          const next = {
            fontSize: typeof persisted.fontSize === 'number' ? persisted.fontSize : 14,
            theme: isDarkMode ? 'dark' : 'light'
          }
          return next
        }
        // Migrate to v3 add autoScroll default true
        if (version === 2 && persisted) {
          return {
            fontSize: typeof persisted.fontSize === 'number' ? persisted.fontSize : 14,
            theme: persisted.theme === 'dark' || persisted.theme === 'gray' ? persisted.theme : 'light',
            autoScroll: true
          } as Settings
        }
        // Migrate to v4 add autoCollapseTools default false
        if (version === 3 && persisted) {
          const migrated = {
            fontSize: typeof persisted.fontSize === 'number' ? persisted.fontSize : 14,
            theme: persisted.theme === 'dark' || persisted.theme === 'gray' ? persisted.theme : 'light',
            autoScroll: typeof persisted.autoScroll === 'boolean' ? persisted.autoScroll : true,
            autoCollapseTools: true
          }
          return migrated as unknown as Settings
        }
        // Migrate to v5 add showPdfPreview default true
        if (version === 4 && persisted) {
          const migrated = {
            fontSize: typeof persisted.fontSize === 'number' ? persisted.fontSize : 14,
            theme: persisted.theme === 'dark' || persisted.theme === 'gray' ? persisted.theme : 'light',
            autoScroll: typeof persisted.autoScroll === 'boolean' ? persisted.autoScroll : true,
            autoCollapseTools: typeof persisted.autoCollapseTools === 'boolean' ? persisted.autoCollapseTools : true,
            showPdfPreview: true
          }
          return migrated as unknown as Settings
        }
        // Migrate to v6 replace autoCollapseTools boolean with autoCollapseDelayMs number
        if (version === 5 && persisted) {
          const migratedDelay = typeof persisted.autoCollapseDelayMs === 'number'
            ? Math.max(0, Math.floor(persisted.autoCollapseDelayMs))
            : (persisted.autoCollapseTools === false ? 0 : DEFAULT_AUTO_COLLAPSE_DELAY_MS)
          const autoCollapseDelayMs: number = Math.min(MAX_AUTO_COLLAPSE_DELAY_MS, migratedDelay)
          return {
            fontSize: typeof persisted.fontSize === 'number' ? persisted.fontSize : 14,
            theme: persisted.theme === 'dark' || persisted.theme === 'gray' ? persisted.theme : 'light',
            autoScroll: typeof persisted.autoScroll === 'boolean' ? persisted.autoScroll : true,
            autoCollapseDelayMs,
            showPdfPreview: typeof persisted.showPdfPreview === 'boolean' ? persisted.showPdfPreview : true
          } as Settings
        }
        // Migrate to v7 add autoCollapseKeys default []
        if (version === 6 && persisted) {
          return {
            ...persisted,
            autoCollapseKeys: Array.isArray(persisted.autoCollapseKeys) ? persisted.autoCollapseKeys : []
          } as Settings
        }
        return persisted as Settings
      }
    }
  )
) 
