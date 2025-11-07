import React, { useEffect, useMemo, useState } from 'react'
import {
  BadgeCheck,
  Globe2,
  Loader2,
  Pencil,
  Plus,
  Trash2
} from 'lucide-react'
import { useThirdPartyLLMProviders } from '../hooks/useThirdPartyLLMProviders'
import { ThirdPartyLLMProvider } from '../types/third-party-llm'

interface ProviderFormState {
  name: string
  url: string
}

function getFaviconUrl(url: string): string | undefined {
  try {
    const normalized = url.trim()
    if (!normalized) return undefined
    const parsed = new URL(normalized.match(/^[a-zA-Z][a-zA-Z0-9+.-]*:/) ? normalized : `https://${normalized}`)
    return `https://www.google.com/s2/favicons?domain=${parsed.hostname}&sz=128`
  } catch {
    return undefined
  }
}

function ProviderRow({
  provider,
  isDefault,
  onSetDefault,
  onEdit,
  onDelete,
  disabled,
  isBrowserOS
}: {
  provider: ThirdPartyLLMProvider
  isDefault: boolean
  onSetDefault: (provider: ThirdPartyLLMProvider) => void
  onEdit: (provider: ThirdPartyLLMProvider) => void
  onDelete: (provider: ThirdPartyLLMProvider) => void
  disabled: boolean
  isBrowserOS: boolean
}) {
  const iconUrl = useMemo(() => getFaviconUrl(provider.url), [provider.url])

  const handleRowClick = () => {
    if (disabled || !isBrowserOS) return
    if (!isDefault) {
      onSetDefault(provider)
    }
  }

  const handleRowKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      handleRowClick()
    }
  }

  return (
    <div
      role="radio"
      aria-checked={isDefault}
      tabIndex={disabled || !isBrowserOS ? -1 : 0}
      onClick={handleRowClick}
      onKeyDown={handleRowKeyDown}
      className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6 p-4 rounded-xl border border-border bg-background/70 hover:bg-accent/40 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center overflow-hidden">
          {iconUrl ? (
            <img src={iconUrl} alt={`${provider.name} icon`} className="w-full h-full object-cover" />
          ) : (
            <Globe2 className="w-6 h-6 text-muted-foreground" />
          )}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-medium text-foreground truncate">{provider.name}</h3>
            {isDefault && (
              <span className="inline-flex items-center gap-1 rounded-full bg-brand/10 px-2.5 py-0.5 text-[11px] font-medium text-brand">
                <BadgeCheck className="w-3 h-3" />
                Default
              </span>
            )}
            {provider.isBuiltIn && (
              <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground uppercase tracking-wide">
                Built-in
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground truncate">{provider.url}</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <label
          className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none"
          onClick={event => event.stopPropagation()}
        >
          <input
            type="radio"
            name="providers-hub-default"
            checked={isDefault}
            onChange={() => onSetDefault(provider)}
            disabled={disabled || !isBrowserOS}
            onClick={event => event.stopPropagation()}
          />
          Use as default
        </label>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="p-2 rounded-lg border border-input text-muted-foreground hover:text-brand hover:border-brand/70 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            onClick={event => {
              event.stopPropagation()
              onEdit(provider)
            }}
            disabled={disabled || !isBrowserOS}
            aria-label={`Edit ${provider.name}`}
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            type="button"
            className="p-2 rounded-lg border border-input text-muted-foreground hover:text-destructive hover:border-destructive/70 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            onClick={event => {
              event.stopPropagation()
              onDelete(provider)
            }}
            disabled={disabled || !isBrowserOS}
            aria-label={`Remove ${provider.name}`}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

export function ProvidersHubSection() {
  const {
    providers,
    selectedProviderId,
    isLoading,
    isSaving,
    error,
    isBrowserOS,
    addProvider,
    updateProvider,
    deleteProvider,
    setSelectedProvider
  } = useThirdPartyLLMProviders()

  const [isFormOpen, setIsFormOpen] = useState(false)
  const [formMode, setFormMode] = useState<'add' | 'edit'>('add')
  const [editingProvider, setEditingProvider] = useState<ThirdPartyLLMProvider | null>(null)
  const [formState, setFormState] = useState<ProviderFormState>({ name: '', url: '' })
  const [formError, setFormError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const faviconPreview = useMemo(() => getFaviconUrl(formState.url), [formState.url])

  useEffect(() => {
    if (formMode === 'edit' && editingProvider) {
      setFormState({ name: editingProvider.name, url: editingProvider.url })
    } else if (formMode === 'add') {
      setFormState({ name: '', url: '' })
      setFormError(null)
    }
  }, [formMode, editingProvider])

  const closeForm = () => {
    setIsFormOpen(false)
    setFormMode('add')
    setEditingProvider(null)
    setFormState({ name: '', url: '' })
    setFormError(null)
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setFormError(null)
    setActionError(null)
    setIsSubmitting(true)

    try {
      if (formMode === 'edit' && editingProvider) {
        await updateProvider(editingProvider.id, formState)
      } else {
        await addProvider(formState)
      }
      closeForm()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save provider'
      setFormError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleEdit = (provider: ThirdPartyLLMProvider) => {
    setEditingProvider(provider)
    setFormMode('edit')
    setIsFormOpen(true)
  }

  const handleDelete = async (provider: ThirdPartyLLMProvider) => {
    setActionError(null)
    const shouldDelete = window.confirm(
      `Remove ${provider.name} from your LLM chat and hub providers?`
    )
    if (!shouldDelete) return

    try {
      await deleteProvider(provider.id)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete provider'
      setActionError(message)
    }
  }

  const handleSetDefault = async (provider: ThirdPartyLLMProvider) => {
    setActionError(null)
    try {
      await setSelectedProvider(provider.id)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to set default provider'
      setActionError(message)
    }
  }

  return (
    <section className="bg-card rounded-2xl border border-border px-6 py-6 shadow-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-brand/10 text-brand flex items-center justify-center">
            <Globe2 className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-medium text-foreground">Configure LLM Chat and Hub</h2>
            <p className="text-sm text-muted-foreground">
              Curate and configure your favourite LLM chat and hub providers
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            setFormMode('add')
            setEditingProvider(null)
            setIsFormOpen(open => !open)
            setFormError(null)
          }}
          disabled={!isBrowserOS}
          className="flex items-center gap-2 px-5 py-2 bg-transparent border-2 border-brand/30 text-foreground rounded-lg hover:border-brand hover:bg-brand/5 hover:text-brand transition-all text-[14px] font-medium flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus className="w-5 h-5" strokeWidth={2} />
          {isFormOpen ? 'Cancel' : 'Add provider'}
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-yellow-400/50 bg-yellow-100/20 px-4 py-3 text-sm text-yellow-800 dark:text-yellow-200">
          {error}
        </div>
      )}

      {isFormOpen && (
        <form
          onSubmit={handleSubmit}
          className="mb-6 space-y-4 rounded-xl border border-dashed border-border bg-background/60 p-4"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-foreground">Provider name</span>
              <input
                type="text"
                value={formState.name}
                onChange={(event) => setFormState(state => ({ ...state, name: event.target.value }))}
                className="rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:border-brand focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand/20 transition-colors"
                placeholder="Deepseek"
                disabled={isSubmitting || isSaving}
              />
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-foreground">Provider URL</span>
              <input
                type="text"
                value={formState.url}
                onChange={(event) => setFormState(state => ({ ...state, url: event.target.value }))}
                className="rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:border-brand focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand/20 transition-colors"
                placeholder="https://chat.deepseek.com/"
                disabled={isSubmitting || isSaving}
              />
            </label>
          </div>

          <p className="text-xs text-muted-foreground">
            Provide the landing page URL for the chat provider. We&apos;ll auto-detect the favicon.
          </p>

          {faviconPreview && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>Icon preview:</span>
              <img src={faviconPreview} alt="Favicon preview" className="h-4 w-4 rounded" />
            </div>
          )}

          {formError && (
            <div className="rounded-lg border border-destructive/60 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {formError}
            </div>
          )}

          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={closeForm}
              className="rounded-lg border border-input bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-accent transition-colors"
              disabled={isSubmitting || isSaving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand/90 transition-colors disabled:opacity-60"
              disabled={isSubmitting || isSaving}
            >
              {(isSubmitting || isSaving) && <Loader2 className="w-4 h-4 animate-spin" />}
              {formMode === 'edit' ? 'Save changes' : 'Save provider'}
            </button>
          </div>
        </form>
      )}

      {actionError && (
        <div className="mb-4 rounded-lg border border-destructive/60 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {actionError}
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center gap-3 rounded-xl border border-border bg-background/70 px-4 py-6 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading providers…
        </div>
      ) : (
        <div className="space-y-3">
          {providers.map(provider => (
            <ProviderRow
              key={provider.id}
              provider={provider}
              isDefault={provider.id === selectedProviderId}
              onSetDefault={handleSetDefault}
              onEdit={handleEdit}
              onDelete={handleDelete}
              disabled={isSaving}
              isBrowserOS={isBrowserOS}
            />
          ))}
        </div>
      )}

      {!isLoading && providers.length === 0 && (
        <div className="mt-6 rounded-xl border border-dashed border-border px-6 py-10 text-center">
          <p className="text-sm text-muted-foreground">
            No providers found. Click &ldquo;Add provider&rdquo; to get started.
          </p>
        </div>
      )}
    </section>
  )
}
