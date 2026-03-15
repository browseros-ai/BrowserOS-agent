import { storage } from '@wxt-dev/storage'
import { useEffect, useState } from 'react'

/**
 * @deprecated Use useMcpConfig() from useMcpConfig.ts instead.
 * Kept for one-time migration to server-side mcp.json.
 */
export type McpTransport = 'http' | 'sse' | 'stdio'

export interface McpServer {
  id: string
  displayName: string
  type: 'managed' | 'custom'
  managedServerName?: string
  managedServerDescription?: string
  config?: {
    url?: string
    description?: string
    transport?: McpTransport
    headers?: Record<string, string>
    command?: string
    args?: string[]
    cwd?: string
    env?: Record<string, string>
  }
}

export const mcpServerStorage = storage.defineItem<McpServer[]>(
  'local:mcpServers',
  {
    fallback: [],
  },
)

/**
 * @deprecated Use useMcpConfig() from useMcpConfig.ts instead.
 * Kept for one-time migration to server-side mcp.json.
 */
export function useMcpServers() {
  const [servers, setServers] = useState<McpServer[]>([])

  useEffect(() => {
    mcpServerStorage.getValue().then(setServers)
    const unwatch = mcpServerStorage.watch((newValue) => {
      setServers(newValue ?? [])
    })
    return unwatch
  }, [])

  const addServer = async (server: McpServer) => {
    const current = (await mcpServerStorage.getValue()) ?? []
    await mcpServerStorage.setValue([...current, server])
  }

  const removeServer = async (id: string) => {
    const current = (await mcpServerStorage.getValue()) ?? []
    await mcpServerStorage.setValue(current.filter((s) => s.id !== id))
  }

  return { servers, addServer, removeServer }
}
