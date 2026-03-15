import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAgentServerUrl } from '@/lib/browseros/useBrowserOSProviders'

export interface McpServerEntry {
  id: string
  displayName: string
  type: 'managed' | 'custom'
  managedServerName?: string
  managedServerDescription?: string
  config?: {
    url?: string
    description?: string
    transport?: 'http' | 'sse' | 'stdio'
    headers?: Record<string, string>
    command?: string
    args?: string[]
    cwd?: string
    env?: Record<string, string>
  }
}

const MCP_CONFIG_KEY = 'mcp-config'

async function fetchMcpConfig(
  baseUrl: string,
): Promise<{ servers: McpServerEntry[] }> {
  const response = await fetch(`${baseUrl}/mcp-config`)
  if (!response.ok) throw new Error('Failed to fetch MCP config')
  return response.json() as Promise<{ servers: McpServerEntry[] }>
}

// List all MCP servers from server-side mcp.json
export function useMcpConfig() {
  const { baseUrl, isLoading: urlLoading } = useAgentServerUrl()

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: [MCP_CONFIG_KEY, baseUrl],
    queryFn: () => fetchMcpConfig(baseUrl as string),
    enabled: !!baseUrl && !urlLoading,
  })

  return {
    servers: data?.servers ?? [],
    isLoading: isLoading || urlLoading,
    error,
    refetch,
  }
}

// Add a new MCP server
export function useAddMcpServer() {
  const { baseUrl } = useAgentServerUrl()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (server: Omit<McpServerEntry, 'id'>) => {
      const response = await fetch(`${baseUrl}/mcp-config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(server),
      })
      if (!response.ok) throw new Error('Failed to add MCP server')
      return response.json() as Promise<{ server: McpServerEntry }>
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [MCP_CONFIG_KEY] })
    },
  })
}

// Remove an MCP server
export function useRemoveMcpServer() {
  const { baseUrl } = useAgentServerUrl()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`${baseUrl}/mcp-config/${id}`, {
        method: 'DELETE',
      })
      if (!response.ok) throw new Error('Failed to remove MCP server')
      return response.json() as Promise<{ success: boolean }>
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [MCP_CONFIG_KEY] })
    },
  })
}
