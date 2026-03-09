import { ExternalLink, Globe, Plus, Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { tweakMatchesUrl } from '@/lib/tweaks/match'
import {
  createDraft,
  draftToTweak,
  getTweaks,
  seedStarterTweaksIfNeeded,
  toggleTweak,
  upsertTweak,
} from '@/lib/tweaks/storage'
import type { TweakRecord } from '@/lib/tweaks/types'

async function openStudio(hostname?: string, tweakId?: string): Promise<void> {
  const url = new URL(chrome.runtime.getURL('app.html'))

  if (hostname) {
    url.searchParams.set('host', hostname)
  }

  if (tweakId) {
    url.searchParams.set('tweak', tweakId)
  }

  await chrome.tabs.create({ url: url.toString() })
}

export function App() {
  const [hostname, setHostname] = useState<string | null>(null)
  const [tweaks, setTweaks] = useState<TweakRecord[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      await seedStarterTweaksIfNeeded()
      const [activeTab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      })

      const nextHostname = activeTab?.url?.startsWith('http')
        ? new URL(activeTab.url).hostname
        : null
      const nextTweaks = await getTweaks()

      if (!cancelled) {
        setHostname(nextHostname)
        setTweaks(nextTweaks)
        setLoading(false)
      }
    }

    load().catch(() => {
      if (!cancelled) {
        setLoading(false)
      }
    })

    return () => {
      cancelled = true
    }
  }, [])

  const matchingTweaks = hostname
    ? tweaks.filter((tweak) => tweakMatchesUrl(tweak.domains, hostname))
    : []

  const handleToggle = async (tweak: TweakRecord) => {
    const nextTweaks = await toggleTweak(tweak.id, !tweak.enabled)
    setTweaks(nextTweaks)
  }

  const handleCreate = async () => {
    const draft = createDraft(hostname ?? undefined)
    const tweak = draftToTweak(draft)
    await upsertTweak(tweak)
    await openStudio(hostname ?? undefined, tweak.id)
    window.close()
  }

  const handleOpenStudio = async () => {
    await openStudio(hostname ?? undefined)
    window.close()
  }

  return (
    <div className="min-w-[360px] bg-background p-4 text-foreground">
      <div className="flex flex-col gap-4">
        <Card className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-[0.18em]">
                <Sparkles className="size-3.5" />
                Tweaks Studio
              </div>
              <h1 className="mt-2 text-2xl">Current site</h1>
              <div className="mt-3 flex items-center gap-2">
                <Badge tone="warning">
                  <Globe className="mr-1 size-3" />
                  {hostname ?? 'Unsupported page'}
                </Badge>
              </div>
            </div>
            <Button variant="secondary" size="sm" onClick={handleOpenStudio}>
              <ExternalLink className="size-4" />
              Open
            </Button>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="font-semibold">Quick controls</div>
              <p className="mt-1 text-muted-foreground text-sm">
                Toggle matching tweaks or start a draft scoped to this host.
              </p>
            </div>
            <Button size="sm" onClick={handleCreate} disabled={!hostname}>
              <Plus className="size-4" />
              New
            </Button>
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="border-b px-4 py-3 font-semibold">
            Matching tweaks
          </div>
          {loading ? (
            <div className="p-4 text-muted-foreground text-sm">Loading…</div>
          ) : matchingTweaks.length === 0 ? (
            <div className="p-4 text-muted-foreground text-sm">
              {hostname
                ? 'No tweaks target this site yet.'
                : 'Open a standard web page to manage site-specific tweaks.'}
            </div>
          ) : (
            <div className="max-h-[320px] overflow-y-auto">
              {matchingTweaks.map((tweak) => (
                <div
                  key={tweak.id}
                  className="flex items-center justify-between gap-3 border-b px-4 py-3 last:border-b-0"
                >
                  <div className="min-w-0">
                    <div className="truncate font-medium">{tweak.name}</div>
                    <div className="truncate text-muted-foreground text-sm">
                      {tweak.description || tweak.domains.join(', ')}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleToggle(tweak)}
                    className={`rounded-full px-3 py-1 font-medium text-xs uppercase tracking-[0.14em] transition ${
                      tweak.enabled
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                    }`}
                  >
                    {tweak.enabled ? 'On' : 'Off'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
