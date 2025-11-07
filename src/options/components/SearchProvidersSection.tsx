import React, { useEffect, useMemo, useState } from 'react'
import { GripVertical, X, Plus, Trash2, ScanSearch } from 'lucide-react'
import { useProviderStore, type Provider } from '@/newtab/stores/providerStore'

function ensureProtocol(url: string) {
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(url)) {
    return url
  }
  return `https://${url}`
}

function getFaviconFromPattern(urlPattern: string) {
  try {
    const sample = urlPattern.includes('%s') ? urlPattern.replace('%s', 'search') : urlPattern
    const normalized = ensureProtocol(sample)
    const parsed = new URL(normalized)
    return `https://www.google.com/s2/favicons?domain=${parsed.hostname}&sz=64`
  } catch {
    return undefined
  }
}

function getProviderIcon(provider: Provider) {
  if (provider.iconUrl) return provider.iconUrl
  if (provider.urlPattern) {
    return getFaviconFromPattern(provider.urlPattern)
  }
  return '/assets/new_tab_search/browseros.svg'
}

interface AddProviderFormState {
  name: string
  urlPattern: string
}

export function SearchProvidersSection() {
  const enabledProviders = useProviderStore(state => state.getEnabledProviders())
  const disabledProviders = useProviderStore(state => state.getDisabledProviders())
  const enableProvider = useProviderStore(state => state.enableProvider)
  const disableProvider = useProviderStore(state => state.disableProvider)
  const reorderEnabledProviders = useProviderStore(state => state.reorderEnabledProviders)
  const reorderDisabledProviders = useProviderStore(state => state.reorderDisabledProviders)
  const addCustomProvider = useProviderStore(state => state.addCustomProvider)
  const removeCustomProvider = useProviderStore(state => state.removeCustomProvider)
  const hasLegacySynced = useProviderStore(state => state.hasLegacySynced)
  const importLegacyProviderSettings = useProviderStore(state => state.importLegacyProviderSettings)

  const [isFormOpen, setIsFormOpen] = useState(false)
  const [formState, setFormState] = useState<AddProviderFormState>({ name: '', urlPattern: '' })
  const [formError, setFormError] = useState<string | null>(null)
  const [draggedProvider, setDraggedProvider] = useState<Provider | null>(null)
  const [dragSource, setDragSource] = useState<'enabled' | 'disabled' | null>(null)
  const [dragOver, setDragOver] = useState<{ list: 'enabled' | 'disabled'; index: number } | null>(null)

  // Legacy migration from localStorage on first load
  useEffect(() => {
    if (!hasLegacySynced) {
      importLegacyProviderSettings()
    }
  }, [hasLegacySynced, importLegacyProviderSettings])

  const faviconPreview = useMemo(() => {
    if (!formState.urlPattern) return undefined
    return getFaviconFromPattern(formState.urlPattern)
  }, [formState.urlPattern])

  const resetDragState = () => {
    setDraggedProvider(null)
    setDragSource(null)
    setDragOver(null)
  }

  const handleDragStart = (provider: Provider, source: 'enabled' | 'disabled') => {
    setDraggedProvider(provider)
    setDragSource(source)
  }

  const handleDropOnProvider = (
    event: React.DragEvent,
    targetIndex: number,
    targetList: 'enabled' | 'disabled'
  ) => {
    event.preventDefault()
    if (!draggedProvider || !dragSource) return

    if (dragSource === targetList) {
      if (targetList === 'enabled') {
        reorderEnabledProviders(
          enabledProviders.findIndex(provider => provider.id === draggedProvider.id),
          targetIndex
        )
      } else {
        reorderDisabledProviders(
          disabledProviders.findIndex(provider => provider.id === draggedProvider.id),
          targetIndex
        )
      }
    } else if (dragSource === 'enabled') {
      disableProvider(draggedProvider.id, targetIndex)
    } else {
      enableProvider(draggedProvider.id, targetIndex)
    }

    resetDragState()
  }

  const handleDropOnList = (event: React.DragEvent, targetList: 'enabled' | 'disabled') => {
    event.preventDefault()
    if (!draggedProvider || !dragSource) return

    if (dragSource === targetList) {
      resetDragState()
      return
    }

    if (targetList === 'enabled') {
      enableProvider(draggedProvider.id)
    } else {
      disableProvider(draggedProvider.id)
    }

    resetDragState()
  }

  const validateForm = () => {
    const name = formState.name.trim()
    const urlPattern = formState.urlPattern.trim()

    if (!name) {
      setFormError('Enter a provider name.')
      return false
    }

    if (!urlPattern) {
      setFormError('Enter a provider URL.')
      return false
    }

    try {
      const normalized = ensureProtocol(urlPattern)
      new URL(normalized)
    } catch {
      setFormError('Enter a valid URL (e.g. https://example.com).')
      return false
    }

    setFormError(null)
    return true
  }

  const handleAddProvider = (event: React.FormEvent) => {
    event.preventDefault()
    if (!validateForm()) return

    addCustomProvider({
      name: formState.name.trim(),
      category: 'search',
      actionType: 'url',
      urlPattern: formState.urlPattern.trim(),
      openIn: 'newTab'
    })

    setFormState({ name: '', urlPattern: '' })
    setIsFormOpen(false)
  }

  const handleRemoveProvider = (provider: Provider) => {
    removeCustomProvider(provider.id)
  }

  const renderProviderRow = (
    provider: Provider,
    index: number,
    list: 'enabled' | 'disabled'
  ) => {
    const isEnabledList = list === 'enabled'
    const isDragTarget = dragOver?.list === list && dragOver.index === index
    const iconUrl = getProviderIcon(provider)

    return (
      <div
        key={provider.id}
        draggable
        onDragStart={() => handleDragStart(provider, list)}
        onDragEnd={resetDragState}
        onDragOver={event => {
          event.preventDefault()
          setDragOver({ list, index })
        }}
        onDrop={event => handleDropOnProvider(event, index, list)}
        onDragLeave={() => setDragOver(current => (current?.index === index && current.list === list ? null : current))}
        className={`flex items-center gap-2 p-2 rounded transition-all cursor-move ${
          isEnabledList ? 'hover:bg-accent' : 'hover:bg-accent/70 opacity-70'
        } ${isDragTarget ? 'border border-dashed border-primary' : ''}`}
      >
        <GripVertical className="w-4 h-4 text-muted-foreground" />
        <img
          src={iconUrl}
          alt={provider.name}
          className="w-5 h-5 rounded"
          onError={event => {
            (event.target as HTMLImageElement).style.visibility = 'hidden'
          }}
        />
        <div className="flex-1 min-w-0">
          <span className="text-sm text-foreground block truncate">{provider.name}</span>
          {provider.isCustom && (
            <span className="text-[11px] text-muted-foreground block truncate">{provider.urlPattern}</span>
          )}
        </div>
        {isEnabledList ? (
          <button
            type="button"
            onClick={() => disableProvider(provider.id)}
            className="p-1 hover:bg-background rounded"
            aria-label={`Disable ${provider.name}`}
          >
            <X className="w-4 h-4" />
          </button>
        ) : (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => enableProvider(provider.id)}
              className="p-1 hover:bg-background rounded"
              aria-label={`Enable ${provider.name}`}
            >
              <Plus className="w-4 h-4" />
            </button>
            {provider.isCustom && (
              <button
                type="button"
                onClick={() => handleRemoveProvider(provider)}
                className="p-1 hover:bg-background rounded"
                aria-label={`Remove ${provider.name}`}
              >
                <Trash2 className="w-4 h-4 text-destructive" />
              </button>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <section className="bg-card rounded-lg px-6 py-5 border border-border shadow-sm">
      {/* Header with Logo */}
      <div className="flex items-start gap-4 mb-6">
        {/* Search Icon Logo */}
        <div className="w-12 h-12 rounded-full bg-brand flex items-center justify-center flex-shrink-0 shadow-md">
          <ScanSearch className="w-6 h-6 text-white" strokeWidth={2} />
        </div>

        {/* Header Text */}
        <div className="flex-1">
          <h2 className="text-foreground text-[18px] font-medium leading-tight mb-1">
            Configure Search Engines
          </h2>
          <p className="text-muted-foreground text-[14px] leading-normal">
            Pick the search engines you want to show in the BrowserOS new tab search bar.
          </p>
        </div>

        {/* Add Provider Button */}
        <button
          type="button"
          onClick={() => setIsFormOpen(open => !open)}
          className="flex items-center gap-2 px-5 py-2 bg-transparent border-2 border-brand/30 text-foreground rounded-lg hover:border-brand hover:bg-brand/5 hover:text-brand transition-all text-[14px] font-medium flex-shrink-0"
        >
          <Plus className="w-5 h-5" strokeWidth={2} />
          <span>{isFormOpen ? 'Cancel' : 'Add provider'}</span>
        </button>
      </div>

      {/* Add Provider Form */}
      {isFormOpen && (
        <form
          onSubmit={handleAddProvider}
          className="space-y-4 rounded-lg border border-dashed border-border/80 bg-background/50 p-4 mb-6"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-foreground">Provider name</span>
              <input
                type="text"
                value={formState.name}
                onChange={event => setFormState(state => ({ ...state, name: event.target.value }))}
                className="rounded-lg border border-input bg-background px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand/20 transition-all"
                placeholder="Example Search"
              />
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-foreground">Provider URL</span>
              <input
                type="text"
                value={formState.urlPattern}
                onChange={event => setFormState(state => ({ ...state, urlPattern: event.target.value }))}
                className="rounded-lg border border-input bg-background px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand/20 transition-all"
                placeholder="https://example.com"
              />
            </label>
          </div>

          <p className="text-xs text-muted-foreground">
            Paste the provider home or search URL. We will grab the favicon automatically.
          </p>

          {faviconPreview && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>Preview icon:</span>
              <img src={faviconPreview} alt="Favicon preview" className="h-4 w-4 rounded" />
            </div>
          )}

          {formError && (
            <div className="rounded-lg border border-destructive bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {formError}
            </div>
          )}

          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => {
                setIsFormOpen(false)
                setFormState({ name: '', urlPattern: '' })
                setFormError(null)
              }}
              className="px-4 py-2 rounded-lg border border-input bg-background hover:bg-accent text-sm font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-brand text-white hover:bg-brand/90 text-sm font-medium transition-colors"
            >
              Save provider
            </button>
          </div>
        </form>
      )}

      {/* Enabled Providers List */}
      <div className="space-y-3">
        <label className="block text-sm font-medium text-foreground">Visible in search dropdown</label>
        <div
          className="min-h-[120px] rounded-lg border border-border bg-background p-3"
          onDragOver={event => event.preventDefault()}
          onDrop={event => handleDropOnList(event, 'enabled')}
        >
          {enabledProviders.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Drag providers here to enable them.
            </p>
          ) : (
            enabledProviders.map((provider, index) => renderProviderRow(provider, index, 'enabled'))
          )}
        </div>
      </div>

      {/* Disabled Providers List */}
      <div className="space-y-3 mt-6">
        <label className="block text-sm font-medium text-foreground">Disabled providers</label>
        <div
          className="min-h-[80px] rounded-lg border border-border bg-muted/20 p-3"
          onDragOver={event => event.preventDefault()}
          onDrop={event => handleDropOnList(event, 'disabled')}
        >
          {disabledProviders.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Drag providers here to hide them from the dropdown.
            </p>
          ) : (
            disabledProviders.map((provider, index) => renderProviderRow(provider, index, 'disabled'))
          )}
        </div>
      </div>
    </section>
  )
}
