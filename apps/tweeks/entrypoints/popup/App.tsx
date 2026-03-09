import { useEffect, useState } from 'react'
import {
  createTweek,
  deleteTweek,
  fetchTweeks,
  type Tweek,
  updateTweek,
} from '../../lib/api'
import { extractDomain } from '../../lib/utils'
import { CreateTweekForm } from './CreateTweekForm'
import { TweekCard } from './TweekCard'

type View = 'list' | 'create'

export function App() {
  const [tweeks, setTweeks] = useState<Tweek[]>([])
  const [currentDomain, setCurrentDomain] = useState('')
  const [currentUrl, setCurrentUrl] = useState('')
  const [view, setView] = useState<View>('list')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0]
      if (tab?.url) {
        const domain = extractDomain(tab.url)
        setCurrentDomain(domain)
        setCurrentUrl(tab.url)
      }
    })
  }, [])

  useEffect(() => {
    if (!currentDomain) return
    setLoading(true)
    setError(null)
    fetchTweeks()
      .then((all) => setTweeks(all))
      .catch(() => setError('Could not connect to BrowserOS server'))
      .finally(() => setLoading(false))
  }, [currentDomain])

  async function refreshTweeks() {
    setLoading(true)
    setError(null)
    try {
      const all = await fetchTweeks()
      setTweeks(all)
    } catch {
      setError('Could not connect to BrowserOS server')
    } finally {
      setLoading(false)
    }
  }

  async function handleToggle(id: string, enabled: boolean) {
    await updateTweek(id, { enabled })
    await refreshTweeks()
  }

  async function handleDelete(id: string) {
    await deleteTweek(id)
    await refreshTweeks()
  }

  async function handleCreate(input: {
    name: string
    description: string
    script: string
    script_type: 'js' | 'css'
  }) {
    await createTweek({
      ...input,
      domain: currentDomain,
      url_pattern: `https://*${currentDomain}/*`,
    })
    await refreshTweeks()
    setView('list')
  }

  const domainTweeks = tweeks.filter((t) => t.domain === currentDomain)
  const otherTweeks = tweeks.filter((t) => t.domain !== currentDomain)

  return (
    <div className="flex max-h-[560px] min-h-[400px] w-[380px] flex-col overflow-hidden">
      <header className="flex items-center justify-between border-border border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary font-bold text-primary-foreground text-xs">
            T
          </div>
          <h1 className="font-semibold text-sm">Tweeks</h1>
        </div>
        {view === 'list' ? (
          <button
            type="button"
            onClick={() => setView('create')}
            className="rounded-md bg-primary px-3 py-1.5 font-medium text-primary-foreground text-xs transition-colors hover:bg-primary/90"
          >
            + New Tweek
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setView('list')}
            className="rounded-md border border-border px-3 py-1.5 font-medium text-xs transition-colors hover:bg-muted"
          >
            Back
          </button>
        )}
      </header>

      <div className="flex-1 overflow-y-auto">
        {view === 'create' ? (
          <CreateTweekForm
            domain={currentDomain}
            url={currentUrl}
            onSubmit={handleCreate}
          />
        ) : (
          <div className="flex flex-col">
            {loading && (
              <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
                Loading...
              </div>
            )}

            {error && (
              <div className="mx-4 mt-3 rounded-md bg-destructive/10 px-3 py-2 text-destructive text-xs">
                {error}
              </div>
            )}

            {!loading && !error && tweeks.length === 0 && (
              <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
                <p className="text-muted-foreground text-sm">No tweeks yet</p>
                <p className="text-muted-foreground text-xs">
                  Create your first tweek to customize this site
                </p>
              </div>
            )}

            {!loading && domainTweeks.length > 0 && (
              <section>
                <h2 className="px-4 pt-3 pb-1 font-semibold text-[11px] text-muted-foreground uppercase tracking-wider">
                  {currentDomain}
                </h2>
                {domainTweeks.map((tweek) => (
                  <TweekCard
                    key={tweek.id}
                    tweek={tweek}
                    onToggle={handleToggle}
                    onDelete={handleDelete}
                  />
                ))}
              </section>
            )}

            {!loading && otherTweeks.length > 0 && (
              <section>
                <h2 className="px-4 pt-3 pb-1 font-semibold text-[11px] text-muted-foreground uppercase tracking-wider">
                  Other Sites
                </h2>
                {otherTweeks.map((tweek) => (
                  <TweekCard
                    key={tweek.id}
                    tweek={tweek}
                    onToggle={handleToggle}
                    onDelete={handleDelete}
                  />
                ))}
              </section>
            )}
          </div>
        )}
      </div>

      <footer className="border-border border-t px-4 py-2 text-center text-[10px] text-muted-foreground">
        BrowserOS Tweeks v0.0.1
      </footer>
    </div>
  )
}
