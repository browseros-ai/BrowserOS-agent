import { useRef } from 'react'
import useDeepCompareEffect from 'use-deep-compare-effect'
import type { LlmProviderConfig } from '@/lib/llm-providers/types'
import { useLlmProviders } from '@/lib/llm-providers/useLlmProviders'
import { type McpServer, useMcpServers } from '@/lib/mcp/mcpServerStorage'

const constructMcpServers = (servers: McpServer[]) => {
  return servers
    .filter((eachServer) => eachServer.type === 'managed')
    .map((each) => each.managedServerName)
}

const constructCustomServers = (servers: McpServer[]) => {
  return servers
    .filter((eachServer) => eachServer.type === 'custom')
    .map((each) => ({
      name: each.displayName,
      url: each.config?.url,
    }))
}

export const useChatRefs = () => {
  const { servers: mcpServers } = useMcpServers()
  const {
    selectedProvider: selectedLlmProvider,
    isLoading: isLoadingProviders,
  } = useLlmProviders()

  const selectedLlmProviderRef = useRef<LlmProviderConfig | null>(
    selectedLlmProvider,
  )
  const enabledMcpServersRef = useRef(constructMcpServers(mcpServers))
  const enabledCustomServersRef = useRef(constructCustomServers(mcpServers))

  useDeepCompareEffect(() => {
    selectedLlmProviderRef.current = selectedLlmProvider
    enabledMcpServersRef.current = constructMcpServers(mcpServers)
    enabledCustomServersRef.current = constructCustomServers(mcpServers)
  }, [selectedLlmProvider, mcpServers])

  return {
    selectedLlmProviderRef,
    enabledMcpServersRef,
    enabledCustomServersRef,
    selectedLlmProvider,
    isLoadingProviders,
  }
}
