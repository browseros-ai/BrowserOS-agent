import { useEffect, useRef } from 'react'
import { useGetMCPServersList } from '@/entrypoints/app/connect-mcp/useGetMCPServersList'
import { useGetUserMCPIntegrations } from '@/entrypoints/app/connect-mcp/useGetUserMCPIntegrations'
import { type McpServer, mcpServerStorage } from './mcpServerStorage'

/**
 * Syncs remote Klavis integrations into local Chrome storage.
 *
 * Klavis ties integrations to an email address, so connecting Gmail on device A
 * and Slack on device A means device B (same email) also has Slack authenticated.
 * But local Chrome storage on device B won't know about Slack.
 *
 * This hook detects authenticated remote integrations missing from local storage
 * and adds them so they appear in the UI (and can be disconnected).
 */
export function useSyncRemoteIntegrations() {
  const { data: userMCPIntegrations, isLoading: isIntegrationsLoading } =
    useGetUserMCPIntegrations()
  const { data: serversList } = useGetMCPServersList()
  const integrationsRef = useRef(userMCPIntegrations)
  const serversListRef = useRef(serversList)
  integrationsRef.current = userMCPIntegrations
  serversListRef.current = serversList
  const hasSynced = useRef(false)

  const integrationCount = userMCPIntegrations?.integrations?.length ?? 0

  useEffect(() => {
    if (isIntegrationsLoading || !integrationCount) return
    if (hasSynced.current) return

    const integrations = integrationsRef.current?.integrations
    if (!integrations) return

    const syncMissing = async () => {
      const localServers = await mcpServerStorage.getValue()
      const remoteAuthenticated = integrations.filter((i) => i.is_authenticated)
      const missing = remoteAuthenticated.filter(
        (remote) =>
          !localServers.some((s) => s.managedServerName === remote.name),
      )

      if (missing.length === 0) return

      const catalog = serversListRef.current
      const newServers: McpServer[] = missing.map((integration) => {
        const catalogEntry = catalog?.servers.find(
          (s) => s.name === integration.name,
        )
        return {
          id: `${Date.now()}-${integration.name}`,
          displayName: integration.name,
          type: 'managed',
          managedServerName: integration.name,
          managedServerDescription: catalogEntry?.description ?? '',
        }
      })

      await mcpServerStorage.setValue([...localServers, ...newServers])
    }

    hasSynced.current = true
    syncMissing()
  }, [isIntegrationsLoading, integrationCount])
}
