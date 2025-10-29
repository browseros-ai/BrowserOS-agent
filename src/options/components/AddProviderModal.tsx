import React, { useState, useEffect } from 'react'
import { X, Copy, CheckCircle2, AlertCircle, ExternalLink, BookOpen } from 'lucide-react'
import { LLMProvider, ProviderType } from '../types/llm-settings'
import { getModelsForProvider, getModelContextLength, ModelInfo } from '../data/models'

interface AddProviderModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (provider: Partial<LLMProvider>) => Promise<void>
  editProvider?: LLMProvider | null
}

const PROVIDER_TYPES: { value: ProviderType; label: string }[] = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'google_gemini', label: 'Google Gemini' },
  { value: 'ollama', label: 'Ollama' },
  { value: 'openrouter', label: 'OpenRouter' },
  { value: 'openai_compatible', label: 'OpenAI Compatible' }
]

// Get model options dynamically from models data with custom option
function getModelOptions(providerType: ProviderType): string[] {
  const builtInModels = getModelsForProvider(providerType).map(m => m.modelId)
  return builtInModels.length > 0 ? [...builtInModels, 'custom'] : ['custom']
}

// Calculate initial context window for default provider
function getInitialContextWindow(): string {
  const defaultProviderType = 'openai'
  const defaultModel = getModelOptions(defaultProviderType)[0]
  const contextLength = getModelContextLength(defaultProviderType, defaultModel)
  return String(contextLength || 128000)
}

const DEFAULT_BASE_URLS: Record<ProviderType, string> = {
  openai: 'https://api.openai.com/v1',
  anthropic: 'https://api.anthropic.com',
  google_gemini: 'https://generativelanguage.googleapis.com',
  ollama: 'http://localhost:11434',
  openrouter: 'https://openrouter.ai/api/v1',
  openai_compatible: '',
  browseros: '',
  custom: ''
}

// Provider-specific configuration
const PROVIDER_CONFIG: Record<string, {
  apiKeyLink?: string
  docLink: string
  setupCommand?: string
  setupNote?: string
  displayName?: string
}> = {
  ollama: {
    setupCommand: 'OLLAMA_ORIGINS="*" ollama serve',
    setupNote: 'Required',
    docLink: 'https://docs.browseros.com/local-LLMs/ollama',
    displayName: 'Ollama'
  },
  openai: {
    apiKeyLink: 'https://platform.openai.com/api-keys',
    docLink: 'https://docs.browseros.com/bring-your-own-keys/openai',
    displayName: 'OpenAI'
  },
  anthropic: {
    apiKeyLink: 'https://console.anthropic.com/settings/keys',
    docLink: 'https://docs.browseros.com/bring-your-own-keys/claude',
    displayName: 'Claude'
  },
  google_gemini: {
    apiKeyLink: 'https://aistudio.google.com/app/apikey',
    docLink: 'https://docs.browseros.com/bring-your-own-keys/gemini',
    displayName: 'Gemini'
  },
  openrouter: {
    apiKeyLink: 'https://openrouter.ai/keys',
    docLink: 'https://docs.browseros.com/bring-your-own-keys/openrouter',
    displayName: 'OpenRouter'
  },
  openai_compatible: {
    docLink: 'https://docs.browseros.com/llm-setup-guide'
  }
}

// Ollama Setup Command Field 
function OllamaSetupCommandField({ providerType }: { providerType: ProviderType }) {
  const [copied, setCopied] = useState(false)
  const config = PROVIDER_CONFIG[providerType]

  if (!config?.setupCommand) return null

  const handleCopy = async () => {
    if (config.setupCommand) {
      await navigator.clipboard.writeText(config.setupCommand)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className="space-y-2">
     
      <label className="block text-[13px] font-normal text-foreground dark:text-[#E8EAED]">
        Setup Command <span className="text-red-500">*</span>
      </label>

      <div className="relative">
        <div className="w-full px-3 py-2 bg-muted/30 dark:bg-muted/20 border border-input dark:border-[#5F6368] rounded-lg flex items-center gap-2 pr-10">
          <code className="flex-1 font-mono text-[12px] text-foreground dark:text-white">
            {config.setupCommand}
          </code>
        </div>
        <button
          onClick={handleCopy}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded hover:bg-muted/50 transition-colors"
          title="Copy command"
        >
          {copied ? (
            <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" />
          ) : (
            <Copy className="w-4 h-4 text-muted-foreground hover:text-foreground transition-colors" />
          )}
        </button>
      </div>

      <p className="text-[11px] text-muted-foreground dark:text-[#9AA0A6] flex items-center gap-1.5">
        <BookOpen className="w-3 h-3" />
        <span>Use above command to start Ollama</span>
        <span className="text-muted-foreground/40">•</span>
        <a
          href={config.docLink}
          target="_blank"
          rel="noopener noreferrer"
          className="text-brand hover:text-brand/80 transition-colors font-medium underline decoration-brand/30 hover:decoration-brand/60"
        >
          Setup guide
        </a>
      </p>
    </div>
  )
}

// API Key Helper 
function APIKeyHelper({ providerType }: { providerType: ProviderType }) {
  const config = PROVIDER_CONFIG[providerType]

  if (!config?.docLink || providerType === 'ollama') return null

  const displayName = config.displayName || 'provider'

  return (
    <p className="text-[11px] text-muted-foreground dark:text-[#9AA0A6] flex items-center gap-1.5 flex-wrap">
      <BookOpen className="w-3 h-3" />
      <a
        href={config.docLink}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-brand hover:text-brand/80 transition-colors font-medium underline decoration-brand/30 hover:decoration-brand/60"
      >
        {displayName} setup guide
      </a>
      {config.apiKeyLink && (
        <>
          <span className="text-muted-foreground/40">•</span>
          <a
            href={config.apiKeyLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-0.5 hover:text-foreground dark:hover:text-white transition-colors"
          >
            Get key
            <ExternalLink className="w-2.5 h-2.5" />
          </a>
        </>
      )}
    </p>
  )
}

export function AddProviderModal({ isOpen, onClose, onSave, editProvider }: AddProviderModalProps) {
  const [providerType, setProviderType] = useState<ProviderType>('openai')
  const [providerName, setProviderName] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [modelId, setModelId] = useState('')
  const [customModelId, setCustomModelId] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [supportsImages, setSupportsImages] = useState(false)
  const [contextWindow, setContextWindow] = useState(getInitialContextWindow)
  const [temperature, setTemperature] = useState('0.7')
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (isOpen) {
      if (editProvider) {
        setProviderType(editProvider.type)
        setProviderName(editProvider.name)
        setBaseUrl(editProvider.baseUrl ?? DEFAULT_BASE_URLS[editProvider.type])

        const availableModels = getModelOptions(editProvider.type)
        const supportsCustom = availableModels.includes('custom')
        const storedModelId = editProvider.modelId || ''

        if (supportsCustom && storedModelId && storedModelId !== 'custom' && !availableModels.includes(storedModelId)) {
          setModelId('custom')
          setCustomModelId(storedModelId)
        } else if (supportsCustom && storedModelId === 'custom') {
          setModelId('custom')
          setCustomModelId('')
        } else {
          const fallbackModel = storedModelId || availableModels[0] || (supportsCustom ? 'custom' : '')
          setModelId(fallbackModel)
          setCustomModelId(fallbackModel === 'custom' ? '' : '')
        }

        setApiKey(editProvider.apiKey || '')
        setSupportsImages(editProvider.capabilities?.supportsImages || false)

        // Use stored context window, or auto-calculate from model if available
        let contextWindowValue = editProvider.modelConfig?.contextWindow
        if (!contextWindowValue && storedModelId) {
          const calculatedContext = getModelContextLength(editProvider.type, storedModelId)
          contextWindowValue = calculatedContext || 128000
        }
        setContextWindow(String(contextWindowValue || 128000))
        setTemperature(String(editProvider.modelConfig?.temperature || 0.7))
      } else {
        // Reset form for new provider
        const defaultProviderType = 'openai'
        const defaultModel = getModelOptions(defaultProviderType)[0]
        const contextLength = getModelContextLength(defaultProviderType, defaultModel) || 128000

        setProviderType(defaultProviderType)
        setProviderName('')
        setBaseUrl(DEFAULT_BASE_URLS[defaultProviderType])
        setModelId(defaultModel)
        setCustomModelId('')
        setContextWindow(String(contextLength))
        setApiKey('')
        setSupportsImages(false)
        setTemperature('0.7')
      }
    }
  }, [isOpen, editProvider])

  useEffect(() => {
    if (!editProvider) {
      setBaseUrl(DEFAULT_BASE_URLS[providerType])
      const options = getModelOptions(providerType)
      const defaultModel = options[0] || (options.includes('custom') ? 'custom' : '')
      setModelId(defaultModel)
      setCustomModelId(defaultModel === 'custom' ? '' : '')

      // Auto-update context window for default model
      if (defaultModel !== 'custom') {
        const contextLength = getModelContextLength(providerType, defaultModel)
        setContextWindow(String(contextLength || 128000))
      }
    }
  }, [providerType, editProvider])

  const handleModelChange = (value: string) => {
    setModelId(value)
    if (value !== 'custom') {
      setCustomModelId('')

      // Auto-update context window for built-in models
      const contextLength = getModelContextLength(providerType, value)
      setContextWindow(String(contextLength || 128000))
    }
  }

  const handleSave = async () => {
    if (!providerName.trim()) {
      alert('Please enter a provider name')
      return
    }

    let resolvedModelId: string
    if (modelId === 'custom') {
      const trimmedCustomId = customModelId.trim()
      if (!trimmedCustomId) {
        alert('Please enter a custom model ID')
        return
      }
      setCustomModelId(trimmedCustomId)
      resolvedModelId = trimmedCustomId
    } else {
      const options = getModelOptions(providerType)
      resolvedModelId = modelId || options[0] || ''
    }

    if (!resolvedModelId) {
      alert('Please select a model ID')
      return
    }

    setIsSaving(true)
    try {
      const provider: Partial<LLMProvider> = {
        id: editProvider?.id || undefined,
        name: providerName,
        type: providerType,
        baseUrl: baseUrl || DEFAULT_BASE_URLS[providerType],
        modelId: resolvedModelId,
        apiKey: apiKey || undefined,
        capabilities: {
          supportsImages
        },
        modelConfig: {
          contextWindow: parseInt(contextWindow, 10) || 128000,
          temperature: parseFloat(temperature) || 0.7
        },
        isBuiltIn: false,
        isDefault: false,
        createdAt: editProvider?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }

      await onSave(provider)
      onClose()
    } catch (error) {
      console.error('Error saving provider:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to save provider. Please try again.'
      alert(errorMessage)
    } finally {
      setIsSaving(false)
    }
  }

  const modelOptions = getModelOptions(providerType)
  const supportsCustomModel = modelOptions.includes('custom')
  const isCustomOnlyOption = supportsCustomModel && modelOptions.length === 1
  const showCustomModelInput = supportsCustomModel && (isCustomOnlyOption || modelId === 'custom')
  const customModelPlaceholder = providerType === 'ollama'
    ? 'e.g., llama3.1:8b or custom-model:latest'
    : providerType === 'openai_compatible'
    ? 'e.g., lmstudio-community/Meta-Llama-3.1-8B-Instruct-GGUF'
    : 'Enter the exact model identifier'

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
      <div
        className="bg-background dark:bg-[#2D2E31] rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col animate-fade-in border border-border dark:border-[#5F6368]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border dark:border-[#5F6368] bg-background-alt dark:bg-[#202124]">
          <h2 className="text-[16px] font-medium text-foreground dark:text-white">
            {editProvider ? 'Edit Provider' : 'Configure New Provider'}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-accent dark:hover:bg-[#3C4043] rounded-full transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4 text-muted-foreground dark:text-[#9AA0A6]" />
          </button>
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5 bg-background dark:bg-[#2D2E31]">
          {/* Provider Type and Name */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor="provider-type" className="block text-[13px] font-normal text-foreground dark:text-[#E8EAED]">
                Provider Type <span className="text-red-500">*</span>
              </label>
              <select
                id="provider-type"
                value={providerType}
                onChange={(e) => setProviderType(e.target.value as ProviderType)}
                className="w-full px-3 py-2 bg-background dark:bg-[#202124] border border-input dark:border-[#5F6368] rounded-lg text-foreground dark:text-white text-[13px] focus:outline-none focus:border-primary dark:focus:border-[#8AB4F8] transition-colors"
                disabled={!!editProvider}
              >
                {PROVIDER_TYPES.map(({ value, label }) => (
                  <option key={value} value={value} className="bg-background dark:bg-[#202124]">
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label htmlFor="provider-name" className="block text-[13px] font-normal text-foreground dark:text-[#E8EAED]">
                Provider Name <span className="text-red-500">*</span>
              </label>
              <input
                id="provider-name"
                type="text"
                value={providerName}
                onChange={(e) => setProviderName(e.target.value)}
                placeholder="e.g., Work OpenAI"
                className="w-full px-3 py-2 bg-background dark:bg-[#202124] border border-input dark:border-[#5F6368] rounded-lg text-foreground dark:text-white text-[13px] placeholder:text-muted-foreground dark:placeholder:text-[#9AA0A6] focus:outline-none focus:border-primary dark:focus:border-[#8AB4F8] transition-colors"
              />
            </div>
          </div>

          {/* Ollama Setup Command Field*/}
          {providerType === 'ollama' && <OllamaSetupCommandField providerType={providerType} />}

          {/* Base URL and Model ID */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor="base-url" className="block text-[13px] font-normal text-foreground dark:text-[#E8EAED]">
                Base URL
              </label>
              <input
                id="base-url"
                type="text"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder={DEFAULT_BASE_URLS[providerType]}
                className="w-full px-3 py-2 bg-background dark:bg-[#202124] border border-input dark:border-[#5F6368] rounded-lg text-foreground dark:text-white text-[13px] placeholder:text-muted-foreground dark:placeholder:text-[#9AA0A6] focus:outline-none focus:border-primary dark:focus:border-[#8AB4F8] transition-colors"
              />
              <p className="text-[11px] text-muted-foreground dark:text-[#9AA0A6]">
                Override the default API endpoint
              </p>
            </div>

            <div className="space-y-2">
              <label htmlFor="model-id" className="block text-[13px] font-normal text-foreground dark:text-[#E8EAED]">
                Model ID <span className="text-red-500">*</span>
              </label>
              {modelOptions.length > 0 && !isCustomOnlyOption && (
                <select
                  id="model-id"
                  value={modelId}
                  onChange={(e) => handleModelChange(e.target.value)}
                  className="w-full px-3 py-2 bg-background dark:bg-[#202124] border border-input dark:border-[#5F6368] rounded-lg text-foreground dark:text-white text-[13px] focus:outline-none focus:border-primary dark:focus:border-[#8AB4F8] transition-colors appearance-none"
                  style={{
                    backgroundImage: "url(\"data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3e%3cpath fill='none' stroke='%239AA0A6' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M2 5l6 6 6-6'/%3e%3c/svg%3e\")",
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'right 0.5rem center',
                    backgroundSize: '1.25em 1.25em',
                    paddingRight: '2.5rem'
                  }}
                >
                  {modelOptions.map((model) => (
                    <option key={model} value={model} className="bg-background dark:bg-[#202124]">
                      {model === 'custom' ? 'Custom' : model}
                    </option>
                  ))}
                </select>
              )}

              {showCustomModelInput && (
                <div className="space-y-1">
                  <input
                    id="custom-model-id"
                    type="text"
                    value={customModelId}
                    onChange={(e) => setCustomModelId(e.target.value)}
                    placeholder={customModelPlaceholder}
                    className="w-full px-3 py-2 bg-background dark:bg-[#202124] border border-input dark:border-[#5F6368] rounded-lg text-foreground dark:text-white text-[13px] placeholder:text-muted-foreground dark:placeholder:text-[#9AA0A6] focus:outline-none focus:border-primary dark:focus:border-[#8AB4F8] transition-colors"
                  />
                  <p className="text-[11px] text-muted-foreground dark:text-[#9AA0A6]">
                    Enter the exact model identifier your provider expects.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* API Key */}
          <div className="space-y-2">
            <label htmlFor="api-key" className="block text-[13px] font-normal text-foreground dark:text-[#E8EAED]">
              API Key
            </label>
            <input
              id="api-key"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Enter your API key (optional for some providers)"
              className="w-full px-3 py-2 bg-background dark:bg-[#202124] border border-input dark:border-[#5F6368] rounded-lg text-foreground dark:text-white text-[13px] placeholder:text-muted-foreground dark:placeholder:text-[#9AA0A6] focus:outline-none focus:border-primary dark:focus:border-[#8AB4F8] transition-colors"
            />
            <div className="space-y-0.5">
              <p className="text-[11px] text-muted-foreground dark:text-[#9AA0A6]">
                Your API key is encrypted and stored locally
              </p>
              <APIKeyHelper providerType={providerType} />
            </div> 
          </div>

          {/* Model Configuration Section */}
          <div className="space-y-4 pt-4 border-t border-border dark:border-[#5F6368]">
            <h3 className="text-[14px] font-medium text-foreground dark:text-white">Model Configuration</h3>

            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={supportsImages}
                  onChange={(e) => setSupportsImages(e.target.checked)}
                  className="w-4 h-4 text-primary dark:text-[#8AB4F8] focus:ring-primary dark:focus:ring-[#8AB4F8] rounded border-input dark:border-[#5F6368] bg-background dark:bg-[#202124]"
                />
                <span className="text-[13px] text-foreground dark:text-[#E8EAED]">Supports Images</span>
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label htmlFor="context-window" className="block text-[13px] font-normal text-foreground dark:text-[#E8EAED]">
                  Context Window Size
                </label>
                <input
                  id="context-window"
                  type="number"
                  value={contextWindow}
                  onChange={(e) => setContextWindow(e.target.value)}
                  placeholder="128000"
                  className="w-full px-3 py-2 bg-background dark:bg-[#202124] border border-input dark:border-[#5F6368] rounded-lg text-foreground dark:text-white text-[13px] placeholder:text-muted-foreground dark:placeholder:text-[#9AA0A6] focus:outline-none focus:border-primary dark:focus:border-[#8AB4F8] transition-colors"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="temperature" className="block text-[13px] font-normal text-foreground dark:text-[#E8EAED]">
                  Temperature (0-2)
                </label>
                <input
                  id="temperature"
                  type="number"
                  step="0.1"
                  min="0"
                  max="2"
                  value={temperature}
                  onChange={(e) => setTemperature(e.target.value)}
                  placeholder="0.7"
                  className="w-full px-3 py-2 bg-background dark:bg-[#202124] border border-input dark:border-[#5F6368] rounded-lg text-foreground dark:text-white text-[13px] placeholder:text-muted-foreground dark:placeholder:text-[#9AA0A6] focus:outline-none focus:border-primary dark:focus:border-[#8AB4F8] transition-colors"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border dark:border-[#5F6368] bg-background-alt dark:bg-[#202124]">
          <button
            onClick={onClose}
            className="px-4 py-2 text-[13px] font-medium text-foreground dark:text-[#8AB4F8] bg-transparent border border-input dark:border-[#5F6368] rounded-lg hover:bg-accent dark:hover:bg-[#3C4043] transition-colors"
            disabled={isSaving}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-[13px] font-medium text-white bg-gradient-to-r from-brand to-orange-500 hover:from-brand/90 hover:to-orange-500/90 rounded-lg transition-all shadow-lg shadow-brand/25 hover:shadow-xl hover:shadow-brand/40 disabled:opacity-50"
            disabled={isSaving}
          >
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
