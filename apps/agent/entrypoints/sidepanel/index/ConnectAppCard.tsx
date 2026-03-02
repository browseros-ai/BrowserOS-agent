import { Plug, X } from 'lucide-react'
import { type FC, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  BREADCRUMB_CONNECT_CLICKED_EVENT,
  BREADCRUMB_CONNECT_DISMISSED_EVENT,
  BREADCRUMB_CONNECT_SHOWN_EVENT,
  MANAGED_MCP_ADDED_EVENT,
} from '@/lib/constants/analyticsEvents'
import { useMcpServers } from '@/lib/mcp/mcpServerStorage'
import { track } from '@/lib/metrics/track'
import { connectAppSuggestionDismissedStorage } from '@/lib/onboarding/breadcrumbStorage'
import { sentry } from '@/lib/sentry/sentry'
import { useAddManagedServer } from '../../app/connect-mcp/useAddManagedServer'
import type { NudgeData } from './getMessageSegments'

interface ConnectAppCardProps {
  data: NudgeData
}

export const ConnectAppCard: FC<ConnectAppCardProps> = ({ data }) => {
  const [dismissed, setDismissed] = useState(false)
  const [alreadyDismissed, setAlreadyDismissed] = useState(true)
  const [connecting, setConnecting] = useState(false)

  const { addServer } = useMcpServers()
  const { trigger: addManagedServerMutation } = useAddManagedServer()

  const appName = (data.appName as string) ?? 'App'
  const reason = (data.reason as string) ?? ''

  useEffect(() => {
    connectAppSuggestionDismissedStorage.getValue().then((val) => {
      setAlreadyDismissed(val)
      if (!val) {
        track(BREADCRUMB_CONNECT_SHOWN_EVENT, { app_name: appName })
      }
    })
  }, [appName])

  if (dismissed || alreadyDismissed) return null

  const handleConnect = async () => {
    setConnecting(true)
    track(BREADCRUMB_CONNECT_CLICKED_EVENT, { app_name: appName })

    try {
      const response = await addManagedServerMutation({
        serverName: appName,
      })

      if (!response.oauthUrl && !response.apiKeyUrl) {
        toast.error(`Failed to connect ${appName}`)
        setConnecting(false)
        return
      }

      addServer({
        id: Date.now().toString(),
        displayName: appName,
        type: 'managed',
        managedServerName: appName,
        managedServerDescription: '',
      })
      track(MANAGED_MCP_ADDED_EVENT, { server_name: appName })

      if (response.apiKeyUrl) {
        window.open(response.apiKeyUrl, '_blank')?.focus()
      } else if (response.oauthUrl) {
        window.open(response.oauthUrl, '_blank')?.focus()
      }

      setDismissed(true)
    } catch (e) {
      toast.error(`Failed to connect ${appName}`)
      sentry.captureException(e)
      setConnecting(false)
    }
  }

  const handleDismiss = () => {
    track(BREADCRUMB_CONNECT_DISMISSED_EVENT, { app_name: appName })
    connectAppSuggestionDismissedStorage.setValue(true)
    setDismissed(true)
  }

  return (
    <div className="relative rounded-lg border border-border/50 bg-card p-4 shadow-sm">
      <button
        type="button"
        onClick={handleDismiss}
        className="absolute top-2 right-2 rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="flex items-start gap-3 pr-6">
        <Plug className="h-5 w-5 shrink-0 text-[var(--accent-orange)]" />
        <div>
          <p className="font-medium text-sm">
            Connect {appName} for better results
          </p>
          {reason && (
            <p className="mt-1 text-muted-foreground text-xs">{reason}</p>
          )}
        </div>
      </div>

      <div className="mt-3 flex gap-2">
        <Button size="sm" onClick={handleConnect} disabled={connecting}>
          {connecting ? 'Connecting...' : `Connect ${appName}`}
        </Button>
        <Button size="sm" variant="ghost" onClick={handleDismiss}>
          Not now
        </Button>
      </div>
    </div>
  )
}
