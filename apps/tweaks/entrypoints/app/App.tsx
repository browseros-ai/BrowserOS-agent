import {
  AlertCircle,
  Brush,
  Check,
  Code2,
  Copy,
  Filter,
  Globe,
  Plus,
  Save,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  formatCapabilitySignal,
  getCapabilitySignals,
} from '@/lib/tweaks/capabilities'
import { exportTweak, importTweak } from '@/lib/tweaks/import-export'
import { tweakMatchesUrl } from '@/lib/tweaks/match'
import {
  createDraft,
  deleteTweak,
  draftToTweak,
  duplicateTweak,
  seedStarterTweaksIfNeeded,
  setDraftKind,
  subscribeToTweaks,
  toggleTweak,
  tweakToDraft,
  upsertTweak,
} from '@/lib/tweaks/storage'
import type { EditorDraft, TweakRecord } from '@/lib/tweaks/types'
import { cn, countLines, formatRelativeDate } from '@/lib/utils'

type FilterMode = 'all' | 'enabled' | 'starter' | 'custom'

function getSearchParams(): { host?: string; tweakId?: string } {
  const params = new URLSearchParams(window.location.search)
  return {
    host: params.get('host') ?? undefined,
    tweakId: params.get('tweak') ?? undefined,
  }
}

function isSameDraft(
  left: EditorDraft | null,
  right: EditorDraft | null,
): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: v1 Studio keeps storage, import, and editor flows in one page container.
export function App() {
  const query = getSearchParams()
  const [tweaks, setTweaks] = useState<TweakRecord[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(
    query.tweakId ?? null,
  )
  const [draft, setDraft] = useState<EditorDraft | null>(null)
  const [search, setSearch] = useState('')
  const [filterMode, setFilterMode] = useState<FilterMode>('all')
  const [importMode, setImportMode] = useState(false)
  const [importText, setImportText] = useState('')
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const currentHost = query.host ?? null

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      const seeded = await seedStarterTweaksIfNeeded()
      if (!cancelled) {
        setTweaks(seeded)
        setSelectedId((current) => current ?? seeded[0]?.id ?? null)
      }
    }

    load().catch((error) => {
      if (!cancelled) {
        setErrorMessage(
          error instanceof Error ? error.message : 'Unable to load tweaks.',
        )
      }
    })

    const unsubscribe = subscribeToTweaks((nextTweaks) => {
      setTweaks(nextTweaks)
    })

    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (tweaks.length === 0) {
      setDraft(null)
      setSelectedId(null)
      return
    }

    const selected =
      tweaks.find((tweak) => tweak.id === selectedId) ??
      tweaks.find((tweak) => tweak.id === query.tweakId) ??
      tweaks[0]

    if (!selected) {
      setDraft(null)
      return
    }

    if (selected.id !== selectedId) {
      setSelectedId(selected.id)
    }

    const nextDraft = tweakToDraft(selected)
    setDraft((current) =>
      isSameDraft(current, nextDraft) ? current : nextDraft,
    )
  }, [query.tweakId, selectedId, tweaks])

  const selectedTweak = tweaks.find((tweak) => tweak.id === selectedId) ?? null
  const filteredTweaks = tweaks.filter((tweak) => {
    if (filterMode === 'enabled' && !tweak.enabled) return false
    if (filterMode === 'starter' && tweak.source !== 'starter') return false
    if (filterMode === 'custom' && tweak.source === 'starter') return false

    const searchText = `${tweak.name} ${tweak.description} ${tweak.domains.join(' ')}`
    if (search && !searchText.toLowerCase().includes(search.toLowerCase())) {
      return false
    }

    if (currentHost && !tweakMatchesUrl(tweak.domains, currentHost)) {
      return false
    }

    return true
  })

  const enabledCount = tweaks.filter((tweak) => tweak.enabled).length
  const currentHostCount = currentHost
    ? tweaks.filter((tweak) => tweakMatchesUrl(tweak.domains, currentHost))
        .length
    : 0

  const dirty =
    selectedTweak && draft && !isSameDraft(draft, tweakToDraft(selectedTweak))

  const selectedCapabilities = selectedTweak
    ? getCapabilitySignals(selectedTweak)
    : []

  const setBanner = (message: string, isError = false) => {
    if (isError) {
      setErrorMessage(message)
      setStatusMessage(null)
      return
    }

    setStatusMessage(message)
    setErrorMessage(null)
  }

  const handleCreate = async () => {
    const created = createDraft(currentHost ?? undefined)
    const saved = draftToTweak(created)
    const nextTweaks = await upsertTweak(saved)
    setTweaks(nextTweaks)
    setSelectedId(saved.id)
    setBanner('Created a new tweak draft.')
  }

  const handleSave = async () => {
    if (!draft) return

    try {
      const saved = draftToTweak(draft)
      const nextTweaks = await upsertTweak(saved)
      setTweaks(nextTweaks)
      setSelectedId(saved.id)
      setBanner('Saved tweak changes.')
    } catch (error) {
      setBanner(
        error instanceof Error ? error.message : 'Unable to save tweak.',
        true,
      )
    }
  }

  const handleToggle = async () => {
    if (!selectedTweak) return

    const nextTweaks = await toggleTweak(
      selectedTweak.id,
      !selectedTweak.enabled,
    )
    setTweaks(nextTweaks)
    setBanner(
      selectedTweak.enabled
        ? 'Tweak disabled.'
        : 'Tweak enabled for matching sites.',
    )
  }

  const handleDuplicate = async () => {
    if (!selectedTweak) return

    const nextTweaks = await duplicateTweak(selectedTweak.id)
    const clone = nextTweaks.find(
      (tweak) => tweak.name === `${selectedTweak.name} Copy`,
    )
    setTweaks(nextTweaks)
    if (clone) {
      setSelectedId(clone.id)
    }
    setBanner('Duplicated tweak as a custom copy.')
  }

  const handleDelete = async () => {
    if (!selectedTweak) return

    const confirmed = window.confirm(
      `Delete "${selectedTweak.name}" from Tweaks Studio?`,
    )
    if (!confirmed) return

    const nextTweaks = await deleteTweak(selectedTweak.id)
    setTweaks(nextTweaks)
    setSelectedId(nextTweaks[0]?.id ?? null)
    setBanner('Deleted tweak.')
  }

  const handleExport = async () => {
    if (!selectedTweak) return

    await navigator.clipboard.writeText(exportTweak(selectedTweak))
    setBanner('Copied tweak export JSON to your clipboard.')
  }

  const handleImport = async () => {
    try {
      const imported = importTweak(importText)
      const nextTweaks = await upsertTweak(imported)
      setTweaks(nextTweaks)
      setSelectedId(imported.id)
      setImportText('')
      setImportMode(false)
      setBanner(
        imported.domains.length === 0
          ? 'Imported tweak. Add domains before enabling it.'
          : 'Imported tweak into your library.',
      )
    } catch (error) {
      setBanner(
        error instanceof Error ? error.message : 'Unable to import tweak text.',
        true,
      )
    }
  }

  return (
    <div className="min-h-screen px-4 py-5 md:px-8 md:py-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <Card className="overflow-hidden p-6 md:p-8">
            <div className="flex flex-col gap-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="max-w-3xl">
                  <Badge>BrowserOS Extension</Badge>
                  <h1 className="mt-4 text-4xl leading-none md:text-5xl">
                    Tweaks Studio
                  </h1>
                  <p className="mt-4 max-w-2xl text-base text-muted-foreground md:text-lg">
                    A local-first BrowserOS take on Tweeks. Install starter
                    recipes, write your own CSS or JavaScript, and keep sites
                    behaving the way you want across reloads.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button onClick={handleCreate}>
                    <Plus className="size-4" />
                    New tweak
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => setImportMode((current) => !current)}
                  >
                    <Upload className="size-4" />
                    {importMode ? 'Close import' : 'Import'}
                  </Button>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <Card className="p-4">
                  <div className="text-muted-foreground text-sm">
                    Total tweaks
                  </div>
                  <div className="mt-2 font-semibold text-3xl">
                    {tweaks.length}
                  </div>
                </Card>
                <Card className="p-4">
                  <div className="text-muted-foreground text-sm">
                    Enabled now
                  </div>
                  <div className="mt-2 font-semibold text-3xl">
                    {enabledCount}
                  </div>
                </Card>
                <Card className="p-4">
                  <div className="text-muted-foreground text-sm">
                    {currentHost
                      ? `Matches for ${currentHost}`
                      : 'Starter recipes'}
                  </div>
                  <div className="mt-2 font-semibold text-3xl">
                    {currentHost
                      ? currentHostCount
                      : tweaks.filter((tweak) => tweak.source === 'starter')
                          .length}
                  </div>
                </Card>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex h-full flex-col justify-between gap-5">
              <div>
                <div className="flex items-center gap-2 font-medium text-muted-foreground text-sm uppercase tracking-[0.18em]">
                  <Sparkles className="size-4" />
                  Working Model
                </div>
                <h2 className="mt-3 text-2xl">
                  Tweeks-inspired, BrowserOS-native
                </h2>
                <p className="mt-3 text-muted-foreground text-sm leading-6">
                  This v1 stays local. Tweaks are stored in extension storage,
                  applied by a content-script runtime, and portable through JSON
                  export or userscript import. No auth, no sync, no server
                  lock-in.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                {currentHost && (
                  <Badge tone="warning">
                    <Globe className="mr-1 size-3" />
                    Current site: {currentHost}
                  </Badge>
                )}
                <Badge tone="muted">CSS + JavaScript</Badge>
                <Badge tone="muted">Userscript import</Badge>
                <Badge tone="muted">Starter library</Badge>
              </div>
            </div>
          </Card>
        </section>

        {(statusMessage || errorMessage) && (
          <Card
            className={cn(
              'p-4 text-sm',
              errorMessage
                ? 'border-destructive/30 bg-destructive/8 text-destructive'
                : 'border-primary/20 bg-primary/8 text-foreground',
            )}
          >
            <div className="flex items-center gap-2">
              {errorMessage ? (
                <AlertCircle className="size-4 shrink-0" />
              ) : (
                <Check className="size-4 shrink-0 text-primary" />
              )}
              <span>{errorMessage ?? statusMessage}</span>
            </div>
          </Card>
        )}

        {importMode && (
          <Card className="p-5">
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-xl">Import tweak</h3>
                  <p className="mt-1 text-muted-foreground text-sm">
                    Paste JSON exported from this extension or a userscript with
                    metadata like <code>@name</code> and <code>@match</code>.
                  </p>
                </div>
                <Button
                  variant="secondary"
                  onClick={() => setImportMode(false)}
                >
                  Dismiss
                </Button>
              </div>
              <Textarea
                value={importText}
                onChange={(event) => setImportText(event.target.value)}
                className="min-h-44 font-mono text-xs"
                placeholder="// ==UserScript==&#10;// @name My tweak&#10;// @match *://*.example.com/*&#10;// ==/UserScript=="
              />
              <div className="flex justify-end">
                <Button onClick={handleImport} disabled={!importText.trim()}>
                  <Upload className="size-4" />
                  Import into library
                </Button>
              </div>
            </div>
          </Card>
        )}

        <section className="grid gap-6 xl:grid-cols-[330px_minmax(0,1fr)]">
          <Card className="overflow-hidden">
            <div className="border-b p-4">
              <div className="flex items-center gap-2">
                <Filter className="size-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search by name, description, or domain"
                />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {(['all', 'enabled', 'starter', 'custom'] as const).map(
                  (mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setFilterMode(mode)}
                      className={cn(
                        'rounded-full px-3 py-1.5 font-medium text-xs uppercase tracking-[0.14em] transition',
                        filterMode === mode
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
                      )}
                    >
                      {mode}
                    </button>
                  ),
                )}
              </div>
            </div>

            <div className="max-h-[70vh] overflow-y-auto">
              {filteredTweaks.length === 0 ? (
                <div className="p-6 text-muted-foreground text-sm">
                  No tweaks match this filter.
                </div>
              ) : (
                filteredTweaks.map((tweak) => {
                  const isSelected = tweak.id === selectedId
                  return (
                    <button
                      key={tweak.id}
                      type="button"
                      onClick={() => setSelectedId(tweak.id)}
                      className={cn(
                        'flex w-full flex-col gap-3 border-b p-4 text-left transition hover:bg-secondary/70',
                        isSelected && 'bg-secondary',
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-medium">{tweak.name}</div>
                          <div className="mt-1 line-clamp-2 text-muted-foreground text-sm">
                            {tweak.description || 'No description yet.'}
                          </div>
                        </div>
                        <Badge tone={tweak.enabled ? 'default' : 'muted'}>
                          {tweak.enabled ? 'On' : 'Off'}
                        </Badge>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Badge tone="muted">{tweak.kind}</Badge>
                        <Badge tone="muted">{tweak.source}</Badge>
                        {tweak.domains.slice(0, 2).map((domain) => (
                          <Badge key={domain} tone="muted">
                            {domain}
                          </Badge>
                        ))}
                        {tweak.domains.length > 2 && (
                          <Badge tone="muted">
                            +{tweak.domains.length - 2}
                          </Badge>
                        )}
                      </div>
                    </button>
                  )
                })
              )}
            </div>
          </Card>

          <Card className="p-5 md:p-6">
            {!draft || !selectedTweak ? (
              <div className="p-8 text-center text-muted-foreground">
                Select a tweak to start editing.
              </div>
            ) : (
              <div className="flex flex-col gap-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-3xl">{selectedTweak.name}</h2>
                      <Badge tone={selectedTweak.enabled ? 'default' : 'muted'}>
                        {selectedTweak.enabled ? 'Enabled' : 'Disabled'}
                      </Badge>
                    </div>
                    <p className="mt-2 text-muted-foreground text-sm">
                      Updated {formatRelativeDate(selectedTweak.updatedAt)} ·{' '}
                      {countLines(selectedTweak.code)} lines ·{' '}
                      {selectedTweak.domains.length} domain
                      {selectedTweak.domains.length === 1 ? '' : 's'}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant={selectedTweak.enabled ? 'secondary' : 'primary'}
                      onClick={handleToggle}
                    >
                      {selectedTweak.enabled ? 'Disable' : 'Enable'}
                    </Button>
                    <Button variant="secondary" onClick={handleDuplicate}>
                      <Copy className="size-4" />
                      Duplicate
                    </Button>
                    <Button variant="secondary" onClick={handleExport}>
                      <Copy className="size-4" />
                      Export
                    </Button>
                    <Button variant="destructive" onClick={handleDelete}>
                      <Trash2 className="size-4" />
                      Delete
                    </Button>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="font-medium text-sm" htmlFor="tweak-name">
                      Name
                    </label>
                    <Input
                      id="tweak-name"
                      value={draft.name}
                      onChange={(event) =>
                        setDraft((current) =>
                          current
                            ? { ...current, name: event.target.value }
                            : current,
                        )
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <span className="font-medium text-sm">Kind</span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className={cn(
                          'flex flex-1 items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm transition',
                          draft.kind === 'css'
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'bg-white/70 hover:bg-secondary',
                        )}
                        onClick={() =>
                          setDraft((current) =>
                            current ? setDraftKind(current, 'css') : current,
                          )
                        }
                      >
                        <Brush className="size-4" />
                        CSS
                      </button>
                      <button
                        type="button"
                        className={cn(
                          'flex flex-1 items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm transition',
                          draft.kind === 'javascript'
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'bg-white/70 hover:bg-secondary',
                        )}
                        onClick={() =>
                          setDraft((current) =>
                            current
                              ? setDraftKind(current, 'javascript')
                              : current,
                          )
                        }
                      >
                        <Code2 className="size-4" />
                        JavaScript
                      </button>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label
                    className="font-medium text-sm"
                    htmlFor="tweak-description"
                  >
                    Description
                  </label>
                  <Textarea
                    id="tweak-description"
                    value={draft.description}
                    onChange={(event) =>
                      setDraft((current) =>
                        current
                          ? { ...current, description: event.target.value }
                          : current,
                      )
                    }
                    className="min-h-20"
                    placeholder="What should this tweak do?"
                  />
                </div>

                <div className="space-y-2">
                  <label
                    className="font-medium text-sm"
                    htmlFor="tweak-domains"
                  >
                    Domains
                  </label>
                  <Textarea
                    id="tweak-domains"
                    value={draft.domainsText}
                    onChange={(event) =>
                      setDraft((current) =>
                        current
                          ? { ...current, domainsText: event.target.value }
                          : current,
                      )
                    }
                    className="min-h-20 font-mono text-xs"
                    placeholder="youtube.com, *.google.com"
                  />
                  <p className="text-muted-foreground text-xs">
                    Plain domains match subdomains too. Wildcards like{' '}
                    <code>*.example.com</code> also work.
                  </p>
                </div>

                <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_260px]">
                  <div className="space-y-2">
                    <label className="font-medium text-sm" htmlFor="tweak-code">
                      Code
                    </label>
                    <Textarea
                      id="tweak-code"
                      value={draft.code}
                      onChange={(event) =>
                        setDraft((current) =>
                          current
                            ? { ...current, code: event.target.value }
                            : current,
                        )
                      }
                      className="min-h-[380px] font-mono text-xs leading-6"
                      placeholder={
                        draft.kind === 'css'
                          ? 'body { font-size: 18px; }'
                          : "return (() => {\n  console.log('Tweaks Studio running on', context.hostname)\n})"
                      }
                    />
                  </div>

                  <div className="space-y-4">
                    <Card className="p-4">
                      <div className="font-semibold text-muted-foreground text-sm uppercase tracking-[0.16em]">
                        Metadata
                      </div>
                      <div className="mt-4 space-y-3 text-sm">
                        <div>
                          <div className="text-muted-foreground">Source</div>
                          <div className="font-medium capitalize">
                            {selectedTweak.source}
                          </div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Type</div>
                          <div className="font-medium">
                            {selectedTweak.kind}
                          </div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Domains</div>
                          <div className="font-medium">
                            {selectedTweak.domains.join(', ')}
                          </div>
                        </div>
                      </div>
                    </Card>

                    <Card className="p-4">
                      <div className="font-semibold text-muted-foreground text-sm uppercase tracking-[0.16em]">
                        Capability signals
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {selectedCapabilities.length === 0 ? (
                          <p className="text-muted-foreground text-sm">
                            No special signals detected in this code.
                          </p>
                        ) : (
                          selectedCapabilities.map((signal) => (
                            <Badge key={signal}>
                              {formatCapabilitySignal(signal)}
                            </Badge>
                          ))
                        )}
                      </div>
                    </Card>

                    <Card className="p-4">
                      <div className="font-semibold text-muted-foreground text-sm uppercase tracking-[0.16em]">
                        Runtime notes
                      </div>
                      <p className="mt-4 text-muted-foreground text-sm leading-6">
                        CSS tweaks update live on matching pages. JavaScript
                        tweaks can return a cleanup function. If imported
                        userscripts do not contain matches, edit domains before
                        enabling them.
                      </p>
                    </Card>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-5">
                  <div className="text-muted-foreground text-sm">
                    {dirty ? 'Unsaved changes' : 'Everything saved'}
                  </div>
                  <Button onClick={handleSave} disabled={!dirty}>
                    <Save className="size-4" />
                    Save changes
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </section>
      </div>
    </div>
  )
}
