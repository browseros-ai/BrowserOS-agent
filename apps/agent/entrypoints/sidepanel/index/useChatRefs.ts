import { useEffect, useRef } from 'react'
import useDeepCompareEffect from 'use-deep-compare-effect'
import type { LlmProviderConfig } from '@/lib/llm-providers/types'
import { useLlmProviders } from '@/lib/llm-providers/useLlmProviders'
import { type McpServer, useMcpServers } from '@/lib/mcp/mcpServerStorage'
import { usePersonalization } from '@/lib/personalization/personalizationStorage'

type CustomMcpServerPayload =
  | {
      transport: 'http' | 'sse'
      name: string
      url: string
      headers?: Record<string, string>
    }
  | {
      transport: 'stdio'
      name: string
      command: string
      args?: string[]
      cwd?: string
      env?: Record<string, string>
    }

const constructMcpServers = (servers: McpServer[]) => {
  return servers
    .filter((eachServer) => eachServer.type === 'managed')
    .map((each) => each.managedServerName)
}

const constructCustomServers = (
  servers: McpServer[],
): CustomMcpServerPayload[] => {
  return servers
    .filter((s) => s.type === 'custom')
    .map((s): CustomMcpServerPayload => {
      const transport = s.config?.transport ?? 'http'

      if (transport === 'stdio') {
        return {
          transport: 'stdio',
          name: s.displayName,
          command: s.config?.command ?? '',
          args: s.config?.args,
          cwd: s.config?.cwd,
          env: s.config?.env,
        }
      }

      return {
        transport,
        name: s.displayName,
        url: s.config?.url ?? '',
        headers: s.config?.headers,
      }
    })
}

export const useChatRefs = () => {
  const { servers: mcpServers } = useMcpServers()
  const {
    selectedProvider: selectedLlmProvider,
    isLoading: isLoadingProviders,
  } = useLlmProviders()
  const { personalization } = usePersonalization()

  const selectedLlmProviderRef = useRef<LlmProviderConfig | null>(
    selectedLlmProvider,
  )
  const enabledMcpServersRef = useRef(constructMcpServers(mcpServers))
  const enabledCustomServersRef = useRef(constructCustomServers(mcpServers))
  const personalizationRef = useRef(personalization)

  useDeepCompareEffect(() => {
    selectedLlmProviderRef.current = selectedLlmProvider
    enabledMcpServersRef.current = constructMcpServers(mcpServers)
    enabledCustomServersRef.current = constructCustomServers(mcpServers)
  }, [selectedLlmProvider, mcpServers])

  useEffect(() => {
    personalizationRef.current = personalization
  }, [personalization])

  return {
    selectedLlmProviderRef,
    enabledMcpServersRef,
    enabledCustomServersRef,
    personalizationRef,
    selectedLlmProvider,
    isLoadingProviders,
  }
}
