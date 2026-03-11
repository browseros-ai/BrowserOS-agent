import {
  CheckCircle2,
  ExternalLink,
  Loader2,
  type LucideIcon,
} from 'lucide-react'
import { type FC, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { MANAGED_MCP_ADDED_EVENT } from '@/lib/constants/analyticsEvents'
import { type McpServer, useMcpServers } from '@/lib/mcp/mcpServerStorage'
import { useSyncRemoteIntegrations } from '@/lib/mcp/useSyncRemoteIntegrations'
import { track } from '@/lib/metrics/track'
import { sentry } from '@/lib/sentry/sentry'
import { ApiKeyDialog } from '../../app/connect-mcp/ApiKeyDialog'
import { useAddManagedServer } from '../../app/connect-mcp/useAddManagedServer'
import { useGetUserMCPIntegrations } from '../../app/connect-mcp/useGetUserMCPIntegrations'
import { useSubmitApiKey } from '../../app/connect-mcp/useSubmitApiKey'

interface ManagedAppConnectionCardProps {
  appName: string
  description: string
  Icon: LucideIcon
  disabled?: boolean
  disabledReason?: string
}

export const ManagedAppConnectionCard: FC<ManagedAppConnectionCardProps> = ({
  appName,
  description,
  Icon,
  disabled = false,
  disabledReason,
}) => {
  const { servers, addServer } = useMcpServers()
  const { data: integrations, mutate: mutateIntegrations } =
    useGetUserMCPIntegrations()
  const { trigger: addManagedServerMutation } = useAddManagedServer()
  const { trigger: submitApiKeyMutation, isMutating: isSubmittingApiKey } =
    useSubmitApiKey()
  const [isConnecting, setIsConnecting] = useState(false)
  const [hasPendingOauth, setHasPendingOauth] = useState(false)
  const [apiKeyServer, setApiKeyServer] = useState<{
    name: string
    apiKeyUrl: string
  } | null>(null)

  useSyncRemoteIntegrations()

  const localServer = useMemo(
    () => servers.find((server) => server.managedServerName === appName),
    [appName, servers],
  )

  const isConnected =
    integrations?.integrations?.find((item) => item.name === appName)
      ?.is_authenticated ?? false
  const showConnected = !disabled && isConnected

  const ensureLocalServer = async () => {
    if (localServer) return

    const server: McpServer = {
      id: `${Date.now()}-${appName}`,
      displayName: appName,
      type: 'managed',
      managedServerName: appName,
      managedServerDescription: description,
    }
    await addServer(server)
    track(MANAGED_MCP_ADDED_EVENT, { server_name: appName })
  }

  const handleConnect = async () => {
    if (disabled) return

    setIsConnecting(true)
    try {
      const response = await addManagedServerMutation({
        serverName: appName,
      })

      await ensureLocalServer()

      if (response.apiKeyUrl) {
        setApiKeyServer({ name: appName, apiKeyUrl: response.apiKeyUrl })
        return
      }

      if (!response.oauthUrl) {
        throw new Error(`No authorization URL returned for ${appName}`)
      }

      window.open(response.oauthUrl, '_blank')?.focus()
      setHasPendingOauth(true)
    } catch (error) {
      toast.error(
        `Failed to connect ${appName}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      )
      sentry.captureException(error)
    } finally {
      setIsConnecting(false)
    }
  }

  const handleRefresh = async () => {
    setIsConnecting(true)
    try {
      const refreshed = await mutateIntegrations()
      const isNowConnected =
        refreshed?.integrations?.find((item) => item.name === appName)
          ?.is_authenticated ?? false
      if (isNowConnected) {
        setHasPendingOauth(false)
      }
    } finally {
      setIsConnecting(false)
    }
  }

  const handleSubmitApiKey = async (apiKey: string) => {
    if (!apiKeyServer) return

    try {
      await submitApiKeyMutation({
        serverName: apiKeyServer.name,
        apiKey,
        apiKeyUrl: apiKeyServer.apiKeyUrl,
      })
      await ensureLocalServer()
      await mutateIntegrations()
      setApiKeyServer(null)
      setHasPendingOauth(false)
      toast.success(`${apiKeyServer.name} connected`)
    } catch (error) {
      toast.error(
        `Failed to connect ${apiKeyServer.name}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      )
      sentry.captureException(error)
    }
  }

  const statusLabel = disabled
    ? disabledReason
    : showConnected
      ? 'Connected'
      : hasPendingOauth || localServer
        ? 'Finish authorization'
        : 'Not connected'

  return (
    <>
      <Card className="border-border/70 bg-background/80 shadow-none">
        <CardContent className="flex flex-col gap-4 p-5">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--accent-orange)]/10">
              <Icon className="h-6 w-6 text-[var(--accent-orange)]" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h3 className="font-medium text-base">{appName}</h3>
                {showConnected && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 font-medium text-emerald-700 text-xs">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Ready
                  </span>
                )}
              </div>
              <p className="text-muted-foreground text-sm">{description}</p>
            </div>
          </div>

          <div className="rounded-2xl border border-border/70 bg-muted/40 px-3 py-2 text-muted-foreground text-sm">
            {statusLabel}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              onClick={handleConnect}
              disabled={disabled || isConnecting || showConnected}
            >
              {isConnecting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ExternalLink className="h-4 w-4" />
              )}
              {showConnected ? 'Connected' : `Connect ${appName}`}
            </Button>

            {!disabled &&
              !showConnected &&
              (hasPendingOauth || localServer) && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleRefresh}
                  disabled={isConnecting}
                >
                  I finished authorizing
                </Button>
              )}
          </div>
        </CardContent>
      </Card>

      <ApiKeyDialog
        open={!!apiKeyServer}
        serverName={apiKeyServer?.name ?? ''}
        isSubmitting={isSubmittingApiKey}
        onOpenChange={(open) => {
          if (!open) setApiKeyServer(null)
        }}
        onSubmit={handleSubmitApiKey}
      />
    </>
  )
}
