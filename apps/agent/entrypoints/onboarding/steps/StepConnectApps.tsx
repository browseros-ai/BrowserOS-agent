import { Check, Loader2, Plug } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { McpServerIcon } from '@/entrypoints/app/connect-mcp/McpServerIcon'
import { useAddManagedServer } from '@/entrypoints/app/connect-mcp/useAddManagedServer'
import { useGetUserMCPIntegrations } from '@/entrypoints/app/connect-mcp/useGetUserMCPIntegrations'
import {
  ONBOARDING_CONNECT_CALENDAR_EVENT,
  ONBOARDING_CONNECT_GMAIL_EVENT,
  ONBOARDING_STEP_COMPLETED_EVENT,
} from '@/lib/constants/analyticsEvents'
import { useMcpServers } from '@/lib/mcp/mcpServerStorage'
import { track } from '@/lib/metrics/track'
import { sentry } from '@/lib/sentry/sentry'
import { type StepDirection, StepTransition } from './StepTransition'

interface StepConnectAppsProps {
  direction: StepDirection
  onContinue: () => void
}

const RECOMMENDED_APPS = [
  { name: 'Gmail', description: 'Read and send emails' },
  { name: 'Google Calendar', description: 'View and manage events' },
]

const MORE_APPS = [
  { name: 'Notion', description: 'Notes, docs, and wikis' },
  { name: 'Slack', description: 'Team messaging and channels' },
  { name: 'GitHub', description: 'Repos, issues, and PRs' },
  { name: 'Linear', description: 'Issue tracking and projects' },
  { name: 'Discord', description: 'Communities and chat servers' },
]

export const StepConnectApps = ({
  direction,
  onContinue,
}: StepConnectAppsProps) => {
  const { servers, addServer } = useMcpServers()
  const { trigger: addManagedServerMutation } = useAddManagedServer()
  const {
    data: userIntegrations,
    isLoading: isIntegrationsLoading,
    mutate: refreshIntegrations,
  } = useGetUserMCPIntegrations()
  const [connectingApp, setConnectingApp] = useState<string | null>(null)
  const [isPolling, setIsPolling] = useState(false)

  // Only poll for integration status after an OAuth flow starts
  useEffect(() => {
    if (!isPolling) return
    const interval = setInterval(() => {
      refreshIntegrations()
    }, 3000)
    return () => clearInterval(interval)
  }, [isPolling, refreshIntegrations])

  const isAppConnected = (appName: string) => {
    return userIntegrations?.integrations?.some(
      (i) => i.name === appName && i.is_authenticated,
    )
  }

  const allApps = [...RECOMMENDED_APPS, ...MORE_APPS]

  const findAppDescription = (appName: string) =>
    allApps.find((a) => a.name === appName)?.description ?? ''

  const handleConnect = async (appName: string) => {
    setConnectingApp(appName)
    try {
      const response = await addManagedServerMutation({ serverName: appName })

      const alreadyAdded = servers?.some((s) => s.managedServerName === appName)
      if (!alreadyAdded) {
        addServer({
          id: Date.now().toString(),
          displayName: appName,
          type: 'managed',
          managedServerName: appName,
          managedServerDescription: findAppDescription(appName),
        })
      }

      if (response.oauthUrl) {
        setIsPolling(true)
        window.open(response.oauthUrl, '_blank')?.focus()
      }

      if (appName === 'Gmail') track(ONBOARDING_CONNECT_GMAIL_EVENT)
      if (appName === 'Google Calendar')
        track(ONBOARDING_CONNECT_CALENDAR_EVENT)
    } catch (e) {
      sentry.captureException(e, {
        extra: { message: 'Failed to connect app during onboarding', appName },
      })
    } finally {
      setConnectingApp(null)
    }
  }

  const handleContinue = () => {
    track(ONBOARDING_STEP_COMPLETED_EVENT, {
      step: 4,
      step_name: 'connect_apps',
      gmail_connected: !!isAppConnected('Gmail'),
      calendar_connected: !!isAppConnected('Google Calendar'),
    })
    onContinue()
  }

  const renderAppRow = (app: { name: string; description: string }) => {
    const connected = isAppConnected(app.name)
    const isConnecting = connectingApp === app.name

    return (
      <div
        key={app.name}
        className="flex items-center gap-4 rounded-lg border border-border bg-card p-4 transition-all hover:border-[var(--accent-orange)]/50"
      >
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
          <McpServerIcon serverName={app.name} size={24} />
        </div>
        <div className="flex-1">
          <div className="font-medium text-sm">{app.name}</div>
          <div className="text-muted-foreground text-xs">{app.description}</div>
        </div>
        {isIntegrationsLoading ? (
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
        ) : connected ? (
          <span className="flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-1 font-medium text-green-600 text-xs">
            <Check className="size-3" />
            Connected
          </span>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleConnect(app.name)}
            disabled={isConnecting}
          >
            {isConnecting ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              'Connect'
            )}
          </Button>
        )}
      </div>
    )
  }

  return (
    <StepTransition direction={direction}>
      <div className="flex h-full flex-col items-center justify-center">
        <div className="w-full max-w-md space-y-6">
          <div className="space-y-2 text-center">
            <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-[var(--accent-orange)]/10">
              <Plug className="size-6 text-[var(--accent-orange)]" />
            </div>
            <h2 className="font-bold text-3xl tracking-tight">
              Connect your apps
            </h2>
            <p className="text-base text-muted-foreground">
              Let your assistant access your apps to help you get things done
            </p>
          </div>

          {/* Recommended */}
          <div className="space-y-2">
            <div className="font-medium text-muted-foreground text-xs uppercase tracking-wider">
              Recommended
            </div>
            <div className="space-y-2">
              {RECOMMENDED_APPS.map(renderAppRow)}
            </div>
          </div>

          {/* More apps */}
          <div className="space-y-2">
            <div className="font-medium text-muted-foreground text-xs uppercase tracking-wider">
              More apps
            </div>
            <div className="space-y-2">{MORE_APPS.map(renderAppRow)}</div>
          </div>

          <Button
            onClick={handleContinue}
            className="w-full bg-[var(--accent-orange)] text-white hover:bg-[var(--accent-orange)]/90"
          >
            Continue
          </Button>
        </div>
      </div>
    </StepTransition>
  )
}
