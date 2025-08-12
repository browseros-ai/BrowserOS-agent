import React, { useEffect, useState } from 'react'
import { z } from 'zod'
import { useSidePanelPortMessaging } from '@/sidepanel/hooks/useSidePanelPortMessaging'
import { MessageType } from '@/lib/types/messaging'
import { 
  BrowserOSProvidersConfig,
  BrowserOSProvidersConfigSchema,
  BrowserOSProvider,
  BrowserOSProviderType,
  BrowserOSProviderTypeSchema
} from '@/lib/llm/settings/browserOSTypes'
import { Button } from '@/sidepanel/components/ui/button'

// Zod schema for the draft provider form
const ProviderFormSchema = z.object({
  id: z.string().min(1),  // provider id
  name: z.string().min(1),  // display name
  type: BrowserOSProviderTypeSchema,  // provider type
  baseUrl: z.string().optional(),  // API base URL
  apiKey: z.string().min(1),  // API key
  modelId: z.string().min(1),  // Model identifier
  supportsImages: z.boolean().optional(),  // Capability
  contextWindow: z.union([z.number(), z.string()]).optional(),  // Context size
  temperature: z.union([z.number(), z.string()]).optional()  // Default temperature
})

type ProviderDraft = z.infer<typeof ProviderFormSchema>

export function ProviderSettingsCard(): JSX.Element | null {
  const { sendMessage, addMessageListener, removeMessageListener } = useSidePanelPortMessaging()
  const [config, setConfig] = useState<BrowserOSProvidersConfig | null>(null)
  const [draftOpen, setDraftOpen] = useState<boolean>(false)
  const [draft, setDraft] = useState<ProviderDraft | null>(null)
  const [saving, setSaving] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null)
  const [editingProviderId, setEditingProviderId] = useState<string | null>(null)
  const [missing, setMissing] = useState<{ name: boolean; apiKey: boolean; modelId: boolean; type: boolean }>({ name: false, apiKey: false, modelId: false, type: false })

  const isDraftSatisfied = !!draft &&
    !!draft.type &&
    !!draft.name && draft.name.trim().length > 0 &&
    !!draft.apiKey && draft.apiKey.trim().length > 0 &&
    !!draft.modelId && draft.modelId.trim().length > 0

  // Listen for background responses on WORKFLOW_STATUS and extract providersConfig when present
  useEffect(() => {
    const handler = (payload: any) => {
      if (payload && payload.status === 'success' && payload.data && payload.data.providersConfig) {
        const cfg = payload.data.providersConfig as BrowserOSProvidersConfig
        setConfig(cfg)
        // Initialize selection once from default provider
        setSelectedProviderId(prev => (prev === null ? cfg.defaultProviderId : prev))
      }
    }
    addMessageListener<any>(MessageType.WORKFLOW_STATUS, handler)
    return () => removeMessageListener<any>(MessageType.WORKFLOW_STATUS, handler)
  }, [addMessageListener, removeMessageListener])

  const onSelectProvider = (providerId: string) => {
    if (!config) return
    const nextProviders = config.providers.map(p => ({ ...p, isDefault: p.id === providerId }))
    const nextConfig: BrowserOSProvidersConfig = {
      defaultProviderId: providerId,
      providers: nextProviders
    }
    try {
      BrowserOSProvidersConfigSchema.parse(nextConfig)
      setConfig(nextConfig)
      setSelectedProviderId(providerId)
      const ok = sendMessage<BrowserOSProvidersConfig>(MessageType.SAVE_LLM_PROVIDERS as any, nextConfig)
      if (!ok) setError('Failed to send save message')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  const onOpenDraft = () => {
    setError(null)
    setDraftOpen(true)
    setEditingProviderId(null)
    setDraft({
      id: `custom_${Date.now()}`,
      name: '',
      type: 'openai_compatible',
      baseUrl: '',
      apiKey: '',
      modelId: '',
      supportsImages: true,
      contextWindow: 128000,
      temperature: 0.7
    })
  }

  const onCancelDraft = () => {
    setDraftOpen(false)
    setDraft(null)
    setError(null)
    setEditingProviderId(null)
  }

  const onEditProvider = (provider: BrowserOSProvider) => {
    setError(null)
    setDraftOpen(true)
    setEditingProviderId(provider.id)
    setDraft({
      id: provider.id,
      name: provider.name,
      type: provider.type,
      baseUrl: provider.baseUrl,
      apiKey: provider.apiKey ?? '',
      modelId: provider.modelId ?? '',
      supportsImages: provider.capabilities?.supportsImages === true,
      contextWindow: provider.modelConfig?.contextWindow,
      temperature: provider.modelConfig?.temperature
    })
  }

  const toProvider = (p: ProviderDraft, isDefault: boolean): BrowserOSProvider => {
    const contextWindow: number | undefined =
      p.contextWindow === undefined || p.contextWindow === ''
        ? undefined
        : (typeof p.contextWindow === 'string' ? parseInt(p.contextWindow, 10) : p.contextWindow)
    const temperature: number | undefined =
      p.temperature === undefined || p.temperature === ''
        ? undefined
        : (typeof p.temperature === 'string' ? parseFloat(p.temperature) : p.temperature)

    return {
      id: p.id,
      name: p.name,
      type: p.type as BrowserOSProviderType,
      isDefault,
      isBuiltIn: false,
      baseUrl: p.baseUrl || undefined,
      apiKey: p.apiKey || undefined,
      modelId: p.modelId || undefined,
      capabilities: p.supportsImages ? { supportsImages: true } : undefined,
      modelConfig: {
        contextWindow,
        temperature
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  }

  const onSave = () => {
    if (!config) return
    setSaving(true)
    setError(null)
    try {
      if (!draft) throw new Error('No provider draft to save')
      // Validate required fields first (friendly UI check)
      const nextMissing = {
        type: !draft.type,
        name: !(draft.name && draft.name.trim().length > 0),
        apiKey: !(draft.apiKey && draft.apiKey.trim().length > 0),
        modelId: !(draft.modelId && draft.modelId.trim().length > 0)
      }
      setMissing(nextMissing)
      const missingLabels: string[] = []
      if (nextMissing.type) missingLabels.push('Provider type')
      if (nextMissing.name) missingLabels.push('Provider name')
      if (nextMissing.apiKey) missingLabels.push('API key')
      if (nextMissing.modelId) missingLabels.push('Model ID')
      if (missingLabels.length > 0) {
        throw new Error(`Please fill required fields: ${missingLabels.join(', ')}`)
      }
      // Zod validation (secondary safety)
      ProviderFormSchema.parse(draft)
      let nextProviders: BrowserOSProvider[]
      if (editingProviderId) {
        // Update existing provider
        const updated = toProvider(draft, config.defaultProviderId === draft.id)
        nextProviders = config.providers.map(p => p.id === editingProviderId ? { ...updated, isBuiltIn: p.isBuiltIn } : p)
      } else {
        // Add new provider
        const created = toProvider(draft, config.defaultProviderId === draft.id)
        nextProviders = [...config.providers, created]
      }
      // Keep isDefault flags in sync
      nextProviders = nextProviders.map(p => ({ ...p, isDefault: p.id === config.defaultProviderId }))
      const nextConfig: BrowserOSProvidersConfig = {
        defaultProviderId: config.defaultProviderId,
        providers: nextProviders
      }
      BrowserOSProvidersConfigSchema.parse(nextConfig)
      const ok = sendMessage<BrowserOSProvidersConfig>(MessageType.SAVE_LLM_PROVIDERS as any, nextConfig)
      if (!ok) setError('Failed to send save message')
      else setDraftOpen(false)
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Validation failed. Please check required fields.'
      setError(message)
    } finally {
      setSaving(false)
    }
  }

  const onDeleteProvider = (providerId: string) => {
    if (!config) return
    const remaining = config.providers.filter(p => p.id !== providerId)
    if (remaining.length === 0) {
      setError('Cannot delete the last provider')
      return
    }
    // Adjust default if needed
    const nextDefault = config.defaultProviderId === providerId ? remaining[0].id : config.defaultProviderId
    const nextProviders = remaining.map(p => ({ ...p, isDefault: p.id === nextDefault }))
    const nextConfig: BrowserOSProvidersConfig = {
      defaultProviderId: nextDefault,
      providers: nextProviders
    }
    try {
      BrowserOSProvidersConfigSchema.parse(nextConfig)
      setConfig(nextConfig)
      if (selectedProviderId === providerId) setSelectedProviderId(nextDefault)
      const ok = sendMessage<BrowserOSProvidersConfig>(MessageType.SAVE_LLM_PROVIDERS as any, nextConfig)
      if (!ok) setError('Failed to send save message')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  if (!config) return null

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-foreground">LLM Providers</h3>
      <div className="p-4 rounded-xl bg-card border border-border/50 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs text-foreground">Default provider</span>
            <select
              className="px-2 py-1 rounded-md border border-border bg-background text-sm"
              value={config.defaultProviderId}
              onChange={(e) => {
                const nextId = e.target.value
                const nextProviders = config.providers.map(p => ({ ...p, isDefault: p.id === nextId }))
                const nextConfig: BrowserOSProvidersConfig = {
                  defaultProviderId: nextId,
                  providers: nextProviders
                }
                try {
                  BrowserOSProvidersConfigSchema.parse(nextConfig)
                  setConfig(nextConfig)
                  const ok = sendMessage<BrowserOSProvidersConfig>(MessageType.SAVE_LLM_PROVIDERS as any, nextConfig)
                  if (!ok) setError('Failed to send save message')
                } catch (err) {
                  setError(err instanceof Error ? err.message : String(err))
                }
              }}
            >
              {config.providers.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            {!draftOpen ? (
              <Button onClick={onOpenDraft} size="sm" variant="outline" className="h-7 px-2 rounded-full text-xs shrink-0 border-sky-400 text-sky-400 hover:text-sky-500">Add provider</Button>
            ) : (
              <Button onClick={onCancelDraft} size="sm" variant="outline" className="h-7 px-2 rounded-full text-xs shrink-0 border-sky-400 text-sky-400 hover:text-sky-500">Cancel</Button>
            )}
            {error && <span className="text-xs text-red-500 ml-2">{error}</span>}
          </div>
        </div>

        <div className="space-y-2">
          {config.providers.map(p => (
            <div key={p.id} className="flex items-center justify-between gap-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="provider"
                  checked={config.defaultProviderId === p.id}
                  onChange={() => onSelectProvider(p.id)}
                />
                <div className="flex flex-col">
                  <span className="text-sm">{p.name}</span>
                  <span className="text-xs text-muted-foreground">{p.type}</span>
                </div>
              </label>
              <div className="flex items-center gap-2">
                {!(p.isBuiltIn || p.id === 'browseros' || p.type === 'browseros') && (
                  <>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 rounded-full text-xs"
                      onClick={() => onEditProvider(p)}
                    >
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 rounded-full text-xs text-red-500 hover:bg-red-500/10"
                      onClick={() => onDeleteProvider(p.id)}
                    >
                      Delete
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>

        {draftOpen && draft && (
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="flex flex-col">
              <label htmlFor="prov-type" className="text-xs font-medium text-foreground">
                Provider Type <span className="text-red-500">*</span>
              </label>
              <select
                id="prov-type"
                className="px-2 py-1 rounded-md border border-border bg-background text-sm"
                value={draft.type}
                onChange={e => setDraft({ ...draft, type: e.target.value as BrowserOSProviderType })}
              >
                {['openai_compatible','anthropic','google_gemini','ollama','openrouter','custom'].map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col">
              <label htmlFor="prov-name" className="text-xs font-medium text-foreground">
                Provider Name <span className="text-red-500">*</span>
              </label>
              <input
                id="prov-name"
                className="px-2 py-1 rounded-md border border-border bg-background text-sm"
                value={draft.name}
                onChange={e => setDraft({ ...draft, name: e.target.value })}
                placeholder="Name"
              />
            </div>

            <div className="flex flex-col">
              <label htmlFor="prov-baseurl" className="text-xs font-medium text-foreground">
                Base URL
              </label>
              <input
                id="prov-baseurl"
                className="px-2 py-1 rounded-md border border-border bg-background text-sm"
                value={draft.baseUrl || ''}
                onChange={e => setDraft({ ...draft, baseUrl: e.target.value })}
                placeholder="Base URL"
              />
            </div>

            <div className="flex flex-col">
              <label htmlFor="prov-model" className="text-xs font-medium text-foreground">
                Model ID <span className="text-red-500">*</span>
              </label>
              <input
                id="prov-model"
                className="px-2 py-1 rounded-md border border-border bg-background text-sm"
                value={draft.modelId || ''}
                onChange={e => setDraft({ ...draft, modelId: e.target.value })}
                placeholder="Model ID"
              />
            </div>

            <div className="flex flex-col col-span-2">
              <label htmlFor="prov-apikey" className="text-xs font-medium text-foreground">
                API Key <span className="text-red-500">*</span>
              </label>
              <input
                id="prov-apikey"
                className="px-2 py-1 rounded-md border border-border bg-background text-sm"
                value={draft.apiKey || ''}
                onChange={e => setDraft({ ...draft, apiKey: e.target.value })}
                placeholder="API Key"
              />
            </div>

            {/* Model Configuration Section */}
            <div className="col-span-2">
              <h4 className="text-xs font-medium text-foreground mb-2">Model Configuration</h4>
              <label className="flex items-center gap-2 text-xs font-medium mb-2">
                <input
                  type="checkbox"
                  checked={!!draft.supportsImages}
                  onChange={e => setDraft({ ...draft, supportsImages: e.target.checked })}
                />
                Supports Images
              </label>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col">
                  <label htmlFor="prov-context-window" className="text-xs font-medium text-foreground">Context Window Size</label>
                  <input
                    id="prov-context-window"
                    className="px-2 py-1 rounded-md border border-border bg-background text-sm"
                    value={String(draft.contextWindow || '')}
                    onChange={e => setDraft({ ...draft, contextWindow: e.target.value })}
                    placeholder="e.g. 128000"
                  />
                </div>
                <div className="flex flex-col">
                  <label htmlFor="prov-temperature" className="text-xs font-medium text-foreground">Temperature (0-2)</label>
                  <input
                    id="prov-temperature"
                    className="px-2 py-1 rounded-md border border-border bg-background text-sm"
                    value={String(draft.temperature || '')}
                    onChange={e => setDraft({ ...draft, temperature: e.target.value })}
                    placeholder="e.g. 0.7"
                  />
                </div>
              </div>
            </div>
            <div className="col-span-2 flex justify-end mt-2">
              <Button onClick={onSave} size="sm" disabled={!isDraftSatisfied || saving}>Save</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}


