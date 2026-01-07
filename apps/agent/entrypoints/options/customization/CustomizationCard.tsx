import { Info, Palette } from 'lucide-react'
import { type FC, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { getBrowserOSAdapter } from '@/lib/browseros/adapter'
import { BROWSEROS_PREFS } from '@/lib/browseros/prefs'

export const CustomizationCard: FC = () => {
  const [showLlmChat, setShowLlmChat] = useState(true)
  const [showLlmHub, setShowLlmHub] = useState(true)
  const [showToolbarLabels, setShowToolbarLabels] = useState(true)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadPrefs = async () => {
      try {
        const adapter = getBrowserOSAdapter()
        const [chatPref, hubPref, labelsPref] = await Promise.all([
          adapter.getPref(BROWSEROS_PREFS.SHOW_LLM_CHAT),
          adapter.getPref(BROWSEROS_PREFS.SHOW_LLM_HUB),
          adapter.getPref(BROWSEROS_PREFS.SHOW_TOOLBAR_LABELS),
        ])
        setShowLlmChat(chatPref?.value !== false)
        setShowLlmHub(hubPref?.value !== false)
        setShowToolbarLabels(labelsPref?.value !== false)
      } catch {
        // API not available - use defaults
      } finally {
        setIsLoading(false)
      }
    }

    loadPrefs()
  }, [])

  const handleToggle = async (
    prefKey: string,
    value: boolean,
    setter: (v: boolean) => void,
  ) => {
    try {
      const adapter = getBrowserOSAdapter()
      await adapter.setPref(prefKey, value)
      setter(value)
    } catch {
      toast.error('Failed to update setting')
    }
  }

  const bothButtonsHidden = !showLlmChat && !showLlmHub && !isLoading

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm transition-all hover:shadow-md">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-orange)]/10">
          <Palette className="h-6 w-6 text-[var(--accent-orange)]" />
        </div>
        <div className="flex-1">
          <h2 className="mb-1 font-semibold text-xl">Customization</h2>
          <p className="mb-6 text-muted-foreground text-sm">
            Personalize your toolbar and browser interface
          </p>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="show-llm-chat" className="font-medium text-sm">
                  Show Chat Button
                </Label>
                <p className="text-muted-foreground text-xs">
                  Display the Chat button in the browser toolbar
                </p>
              </div>
              <Switch
                id="show-llm-chat"
                checked={showLlmChat}
                onCheckedChange={(checked) =>
                  handleToggle(
                    BROWSEROS_PREFS.SHOW_LLM_CHAT,
                    checked,
                    setShowLlmChat,
                  )
                }
                disabled={isLoading}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="show-llm-hub" className="font-medium text-sm">
                  Show Hub Button
                </Label>
                <p className="text-muted-foreground text-xs">
                  Display the Hub button in the browser toolbar
                </p>
              </div>
              <Switch
                id="show-llm-hub"
                checked={showLlmHub}
                onCheckedChange={(checked) =>
                  handleToggle(
                    BROWSEROS_PREFS.SHOW_LLM_HUB,
                    checked,
                    setShowLlmHub,
                  )
                }
                disabled={isLoading}
              />
            </div>

            <div className="flex items-center justify-between border-border border-t pt-4">
              <div className="space-y-0.5">
                <Label
                  htmlFor="show-toolbar-labels"
                  className="font-medium text-sm"
                >
                  Show Button Labels
                </Label>
                <p className="text-muted-foreground text-xs">
                  Display text labels next to toolbar button icons
                </p>
              </div>
              <Switch
                id="show-toolbar-labels"
                checked={showToolbarLabels}
                onCheckedChange={(checked) =>
                  handleToggle(
                    BROWSEROS_PREFS.SHOW_TOOLBAR_LABELS,
                    checked,
                    setShowToolbarLabels,
                  )
                }
                disabled={isLoading}
              />
            </div>

            {bothButtonsHidden && (
              <Alert className="mt-4">
                <Info className="h-4 w-4" />
                <AlertTitle>Both buttons hidden</AlertTitle>
                <AlertDescription>
                  You can still access Chat and Hub from the browser menu.
                </AlertDescription>
              </Alert>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
