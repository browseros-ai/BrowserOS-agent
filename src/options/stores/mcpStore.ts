import { create } from 'zustand'
import { MCPSettings, MCPTestResult, MCPSettingsSchema } from '../types/mcp-settings'

const MCP_STORAGE_KEY = 'browseros-mcp-settings'

interface MCPStore {
  settings: MCPSettings
  testResult: MCPTestResult

  setEnabled: (enabled: boolean) => Promise<void>
  setServerUrl: (url: string) => void
  setPort: (port: number) => void
  setTestResult: (result: MCPTestResult) => void
  loadSettings: () => Promise<void>
}

const readMCPSettings = async (): Promise<MCPSettings | null> => {
  if (!chrome.storage?.local) return null

  try {
    const result = await new Promise<Record<string, unknown>>((resolve) => {
      chrome.storage.local.get(MCP_STORAGE_KEY, (result) => resolve(result ?? {}))
    })

    const raw = result?.[MCP_STORAGE_KEY]
    if (raw) {
      const data = typeof raw === 'string' ? JSON.parse(raw) : raw
      return MCPSettingsSchema.parse(data)
    }
  } catch (error) {
    console.error('[mcpStore] Failed to read MCP settings:', error)
  }

  return null
}

const writeMCPSettings = async (settings: MCPSettings): Promise<boolean> => {
  if (!chrome.storage?.local) return false

  try {
    await new Promise<void>((resolve, reject) => {
      chrome.storage.local.set(
        { [MCP_STORAGE_KEY]: JSON.stringify(settings) },
        () => {
          if (chrome.runtime?.lastError) {
            reject(chrome.runtime.lastError)
          } else {
            resolve()
          }
        }
      )
    })
    return true
  } catch (error) {
    console.error('[mcpStore] Failed to save MCP settings:', error)
    return false
  }
}

export const useMCPStore = create<MCPStore>((set, get) => ({
  settings: {
    enabled: false,
    serverUrl: '',
    port: undefined
  },
  testResult: {
    status: 'idle',
    error: undefined,
    timestamp: undefined
  },

  setEnabled: async (enabled: boolean) => {
    const currentSettings = get().settings
    const newSettings = { ...currentSettings, enabled }

    const success = await writeMCPSettings(newSettings)
    if (success) {
      set({ settings: newSettings })
    }
  },

  setServerUrl: (url: string) => {
    set((state) => ({
      settings: { ...state.settings, serverUrl: url }
    }))
  },

  setPort: (port: number) => {
    set((state) => ({
      settings: { ...state.settings, port }
    }))
  },

  setTestResult: (result: MCPTestResult) => {
    set({ testResult: result })
  },

  loadSettings: async () => {
    const settings = await readMCPSettings()
    if (settings) {
      set({ settings })
    }
  }
}))
