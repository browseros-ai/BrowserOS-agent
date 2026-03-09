import useSWR from 'swr'
import useSWRMutation from 'swr/mutation'
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

interface McpConfigResponse {
  servers: McpServerEntry[]
}

const MCP_CONFIG_KEY = 'mcp-config'

const fetchMcpConfig = async ([hostUrl]: [
  string,
]): Promise<McpConfigResponse> => {
  const response = await fetch(`${hostUrl}/mcp-config`)
  if (!response.ok) throw new Error('Failed to fetch MCP config')
  return response.json() as Promise<McpConfigResponse>
}

// List all MCP servers from server-side mcp.json
export function useMcpConfig() {
  const { baseUrl } = useAgentServerUrl()

  const { data, error, isLoading, mutate } = useSWR(
    baseUrl ? [baseUrl, MCP_CONFIG_KEY] : null,
    fetchMcpConfig,
    { keepPreviousData: true },
  )

  return {
    servers: data?.servers ?? [],
    isLoading,
    error,
    mutate,
  }
}

// Add a new MCP server
const addServer = async (
  url: string,
  { arg }: { arg: Omit<McpServerEntry, 'id'> },
): Promise<{ server: McpServerEntry }> => {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(arg),
  })
  if (!response.ok) throw new Error('Failed to add MCP server')
  return response.json() as Promise<{ server: McpServerEntry }>
}

export function useAddMcpServer() {
  const { baseUrl } = useAgentServerUrl()

  return useSWRMutation(baseUrl ? `${baseUrl}/mcp-config` : null, addServer)
}

// Remove an MCP server
const removeServerFn = async (
  url: string,
  { arg }: { arg: { id: string } },
): Promise<{ success: boolean }> => {
  const response = await fetch(`${url}/${arg.id}`, { method: 'DELETE' })
  if (!response.ok) throw new Error('Failed to remove MCP server')
  return response.json() as Promise<{ success: boolean }>
}

export function useRemoveMcpServer() {
  const { baseUrl } = useAgentServerUrl()

  return useSWRMutation(
    baseUrl ? `${baseUrl}/mcp-config` : null,
    removeServerFn,
  )
}
