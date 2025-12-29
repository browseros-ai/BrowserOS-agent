import { AlertCircle, Loader2, RefreshCw, Settings, X } from 'lucide-react'
import { type FC, useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { getBrowserOSAdapter } from '@/lib/browseros/adapter'
import { BROWSEROS_PREFS } from '@/lib/browseros/prefs'
import {
  MCP_EXTERNAL_ACCESS_DISABLED_EVENT,
  MCP_EXTERNAL_ACCESS_ENABLED_EVENT,
  MCP_SERVER_RESTARTED_EVENT,
} from '@/lib/constants/analyticsEvents'
import { sendServerMessage } from '@/lib/messaging/server/serverMessages'
import { track } from '@/lib/metrics/track'

const HEALTH_CHECK_TIMEOUT_MS = 60_000
const HEALTH_CHECK_INTERVAL_MS = 2_000
const LONG_WAIT_THRESHOLD_MS = 15_000

type DialogType = 'enable-remote' | 'restart' | null

interface ServerSettingsCardProps {
  onServerRestart?: () => void
}

export const ServerSettingsCard: FC<ServerSettingsCardProps> = ({
  onServerRestart,
}) => {
  const [allowRemote, setAllowRemote] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isRestarting, setIsRestarting] = useState(false)
  const [restartMessage, setRestartMessage] = useState('Restarting server...')
  const [dialogType, setDialogType] = useState<DialogType>(null)
  const [serverError, setServerError] = useState<string | null>(null)

  useEffect(() => {
    const loadCurrentPref = async () => {
      try {
        const adapter = getBrowserOSAdapter()
        const pref = await adapter.getPref(BROWSEROS_PREFS.ALLOW_REMOTE_MCP)
        setAllowRemote(pref?.value === true)
      } catch {
        // API not available or error
      } finally {
        setIsLoading(false)
      }
    }

    loadCurrentPref()
  }, [])

  const checkServerHealth = useCallback(async (): Promise<boolean> => {
    try {
      const result = await sendServerMessage('checkHealth', undefined)
      return result.healthy
    } catch {
      return false
    }
  }, [])

  const waitForServerRestart = useCallback(async (): Promise<boolean> => {
    const startTime = Date.now()

    return new Promise((resolve) => {
      const checkHealth = async () => {
        const elapsed = Date.now() - startTime

        if (elapsed >= HEALTH_CHECK_TIMEOUT_MS) {
          resolve(false)
          return
        }

        if (elapsed >= LONG_WAIT_THRESHOLD_MS) {
          setRestartMessage('Taking longer than expected...')
        }

        const isHealthy = await checkServerHealth()
        if (isHealthy) {
          resolve(true)
          return
        }

        setTimeout(checkHealth, HEALTH_CHECK_INTERVAL_MS)
      }

      setTimeout(checkHealth, HEALTH_CHECK_INTERVAL_MS)
    })
  }, [checkServerHealth])

  const handleToggleChange = (checked: boolean) => {
    if (checked) {
      setDialogType('enable-remote')
    } else {
      performToggle(false)
    }
  }

  const performToggle = async (newValue: boolean) => {
    setIsRestarting(true)
    setRestartMessage('Restarting server...')
    setDialogType(null)
    setServerError(null)

    try {
      const adapter = getBrowserOSAdapter()
      const success = await adapter.setPref(
        BROWSEROS_PREFS.ALLOW_REMOTE_MCP,
        newValue,
      )

      if (!success) {
        throw new Error('Failed to update setting')
      }

      const serverRestarted = await waitForServerRestart()

      if (serverRestarted) {
        setAllowRemote(newValue)
        track(
          newValue
            ? MCP_EXTERNAL_ACCESS_ENABLED_EVENT
            : MCP_EXTERNAL_ACCESS_DISABLED_EVENT,
        )
        toast.success('Server restarted successfully', {
          description: newValue
            ? 'Remote connections are now enabled'
            : 'Remote connections are now disabled',
        })
        onServerRestart?.()
      } else {
        setServerError(
          'Server did not respond. Please quit and restart the browser, then try again.',
        )
      }
    } catch (error) {
      setServerError(
        error instanceof Error ? error.message : 'Failed to update setting',
      )
    } finally {
      setIsRestarting(false)
    }
  }

  const handleRestartClick = () => {
    setDialogType('restart')
  }

  const performRestart = async () => {
    setIsRestarting(true)
    setRestartMessage('Restarting server...')
    setDialogType(null)
    setServerError(null)

    try {
      const adapter = getBrowserOSAdapter()
      await adapter.setPref(BROWSEROS_PREFS.RESTART_SERVER, true)

      const serverRestarted = await waitForServerRestart()

      if (serverRestarted) {
        track(MCP_SERVER_RESTARTED_EVENT)
        toast.success('Server restarted successfully')
        onServerRestart?.()
      } else {
        setServerError(
          'Server did not respond. Please quit and restart the browser, then try again.',
        )
      }
    } catch (error) {
      setServerError(
        error instanceof Error ? error.message : 'Failed to restart server',
      )
    } finally {
      setIsRestarting(false)
    }
  }

  return (
    <>
      <div className="relative rounded-xl border border-border bg-card p-6 shadow-sm transition-all hover:shadow-md">
        {isRestarting && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-xl bg-card/80 backdrop-blur-sm">
            <Loader2 className="h-8 w-8 animate-spin text-[var(--accent-orange)]" />
            <p className="mt-3 font-medium text-sm">{restartMessage}</p>
          </div>
        )}

        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-orange)]/10">
            <Settings className="h-6 w-6 text-[var(--accent-orange)]" />
          </div>
          <div className="flex-1">
            <h2 className="mb-1 font-semibold text-xl">MCP Server Settings</h2>
            <p className="mb-6 text-muted-foreground text-sm">
              Configure local MCP server options
            </p>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="allow-remote" className="font-medium text-sm">
                    Allow External Access
                  </Label>
                  <p className="text-muted-foreground text-xs">
                    Allow MCP clients from other devices to connect
                  </p>
                </div>
                <Switch
                  id="allow-remote"
                  checked={allowRemote}
                  onCheckedChange={handleToggleChange}
                  disabled={isLoading || isRestarting}
                />
              </div>

              <div className="flex items-center justify-between border-border border-t pt-4">
                <div className="space-y-0.5">
                  <span className="font-medium text-sm">
                    Restart MCP Server
                  </span>
                  <p className="text-muted-foreground text-xs">
                    Restart local MCP server
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRestartClick}
                  disabled={isLoading || isRestarting}
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Restart
                </Button>
              </div>

              {serverError && (
                <Alert
                  variant="destructive"
                  className="mt-4 border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950"
                >
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle className="flex items-center justify-between">
                    <span>Server Error</span>
                    <button
                      type="button"
                      onClick={() => setServerError(null)}
                      className="-mt-1 -mr-1 rounded-sm p-1 opacity-70 transition-opacity hover:opacity-100"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </AlertTitle>
                  <AlertDescription>{serverError}</AlertDescription>
                </Alert>
              )}
            </div>
          </div>
        </div>
      </div>

      <AlertDialog
        open={dialogType === 'enable-remote'}
        onOpenChange={(open) => !open && setDialogType(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Allow External Access?</AlertDialogTitle>
            <AlertDialogDescription>
              By default, the MCP server only accepts connections from localhost
              (127.0.0.1). Enabling this will allow any device on your network
              to connect. Only enable if you need to connect from another
              machine and trust your network.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => performToggle(true)}>
              Enable
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={dialogType === 'restart'}
        onOpenChange={(open) => !open && setDialogType(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restart MCP Server?</AlertDialogTitle>
            <AlertDialogDescription>
              This will restart the local MCP server. It may take 10-30 seconds
              to complete. Any active connections will be temporarily
              interrupted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={performRestart}>
              Restart
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
