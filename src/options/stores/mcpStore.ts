import { create } from 'zustand'
import { MCPSettings, MCPTestResult, MCPSettingsSchema } from '../types/mcp-settings'
import { getBrowserOSAdapter } from '@/lib/browser/BrowserOSAdapter'

const MCP_PREF_KEYS = {
  ENABLED: 'browseros.server.mcp_enabled',
  PORT: 'browseros.server.mcp_port'
}

interface MCPStore {
  settings: MCPSettings
  testResult: MCPTestResult

  setEnabled: (enabled: boolean) => Promise<void>
  setPort: (port: number) => Promise<void>
  setTestResult: (result: MCPTestResult) => void
  loadSettings: () => Promise<void>
}

const readMCPSettings = async (): Promise<MCPSettings> => {
  const adapter = getBrowserOSAdapter()

  try {
    const [enabledPref, portPref] = await Promise.all([
      adapter.getPref(MCP_PREF_KEYS.ENABLED),
      adapter.getPref(MCP_PREF_KEYS.PORT)
    ])

    const enabled = enabledPref?.value ?? false
    const port = portPref?.value ?? undefined
    const serverUrl = port ? `http://127.0.0.1:${port}/mcp` : ''

    return { enabled, port, serverUrl }
  } catch (error) {
    console.error('[mcpStore] Failed to read MCP settings:', error)
    return {
      enabled: false,
      serverUrl: '',
      port: undefined
    }
  }
}

const writeMCPSettings = async (settings: MCPSettings): Promise<boolean> => {
  const adapter = getBrowserOSAdapter()

  try {
    const enabledSuccess = await adapter.setPref(MCP_PREF_KEYS.ENABLED, settings.enabled)
    const portSuccess = settings.port
      ? await adapter.setPref(MCP_PREF_KEYS.PORT, settings.port)
      : true

    return enabledSuccess && portSuccess
  } catch (error) {
    console.error('[mcpStore] Failed to write MCP settings:', error)
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
    const newSettings = {
      ...currentSettings,
      enabled
    }

    const success = await writeMCPSettings(newSettings)
    if (success) {
      set({ settings: newSettings })
    }
  },

  setPort: async (port: number) => {
    const currentSettings = get().settings
    const newSettings = {
      ...currentSettings,
      port,
      serverUrl: `http://127.0.0.1:${port}/mcp`
    }

    const success = await writeMCPSettings(newSettings)
    if (success) {
      set({ settings: newSettings })
    }
  },

  setTestResult: (result: MCPTestResult) => {
    set({ testResult: result })
  },

  loadSettings: async () => {
    const settings = await readMCPSettings()
    set({ settings })
  }
}))
