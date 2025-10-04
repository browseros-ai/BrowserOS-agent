import React, { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { LLMProvider, ProviderType } from '../types/llm-settings'

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

const MODEL_OPTIONS: Record<ProviderType, string[]> = {
  openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo', 'gpt-4'],
  anthropic: ['claude-3-5-sonnet-latest', 'claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku', 'claude-2.1'],
  google_gemini: ['gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-pro', 'gemini-pro-vision'],
  ollama: ['llama2', 'mistral', 'codellama', 'phi', 'neural-chat', 'qwen3:4b', 'custom'],
  openrouter: ['auto', 'anthropic/claude-3.5-sonnet', 'openai/gpt-4o'],
  openai_compatible: ['custom'],
  browseros: ['auto'],
  custom: ['custom']
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

export function AddProviderModal({ isOpen, onClose, onSave, editProvider }: AddProviderModalProps) {
  const [providerType, setProviderType] = useState<ProviderType>('openai')
  const [providerName, setProviderName] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [modelId, setModelId] = useState('')
  const [customModelId, setCustomModelId] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [supportsImages, setSupportsImages] = useState(false)
  const [contextWindow, setContextWindow] = useState('128000')
  const [temperature, setTemperature] = useState('0.7')
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (isOpen) {
      if (editProvider) {
        setProviderType(editProvider.type)
        setProviderName(editProvider.name)
        setBaseUrl(editProvider.baseUrl || DEFAULT_BASE_URLS[editProvider.type])

        // Check if the model is a custom Ollama model
        const isOllamaCustom = editProvider.type === 'ollama' &&
          !MODEL_OPTIONS.ollama.includes(editProvider.modelId || '') &&
          editProvider.modelId !== 'custom'

        if (isOllamaCustom) {
          setModelId('custom')
          setCustomModelId(editProvider.modelId || '')
        } else {
          setModelId(editProvider.modelId || MODEL_OPTIONS[editProvider.type][0])
          setCustomModelId('')
        }

        setApiKey(editProvider.apiKey || '')
        setSupportsImages(editProvider.capabilities?.supportsImages || false)
        setContextWindow(String(editProvider.modelConfig?.contextWindow || 128000))
        setTemperature(String(editProvider.modelConfig?.temperature || 0.7))
      } else {
        setProviderType('openai')
        setProviderName('')
        setBaseUrl(DEFAULT_BASE_URLS.openai)
        setModelId(MODEL_OPTIONS.openai[0])
        setCustomModelId('')
        setApiKey('')
        setSupportsImages(false)
        setContextWindow('128000')
        setTemperature('0.7')
      }
    }
  }, [isOpen, editProvider])

  useEffect(() => {
    if (!editProvider) {
      setBaseUrl(DEFAULT_BASE_URLS[providerType])
      setModelId(MODEL_OPTIONS[providerType][0])
      setCustomModelId('')
    }
  }, [providerType, editProvider])

  const handleSave = async () => {
    if (!providerName.trim()) {
      alert('Please enter a provider name')
      return
    }

    // Validate custom model for Ollama
    if (providerType === 'ollama' && modelId === 'custom' && !customModelId.trim()) {
      alert('Please enter a custom model ID for Ollama')
      return
    }

    setIsSaving(true)
    try {
      const provider: Partial<LLMProvider> = {
        id: editProvider?.id || undefined,
        name: providerName,
        type: providerType,
        baseUrl: baseUrl || DEFAULT_BASE_URLS[providerType],
        modelId: (providerType === 'ollama' && modelId === 'custom')
          ? customModelId
          : (modelId || MODEL_OPTIONS[providerType][0]),
        apiKey: apiKey || undefined,
        capabilities: {
          supportsImages
        },
        modelConfig: {
          contextWindow: parseInt(contextWindow, 10) || 128000,
          temperature: parseFloat(temperature) || 0.7
        },
        isBuiltIn: false,
        isDefault: false,  // Required field, but we don't use it for display
        createdAt: editProvider?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }

      await onSave(provider)
      onClose()
    } catch (error) {
      console.error('Error saving provider:', error)
      alert('Failed to save provider. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

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
              {providerType === 'ollama' && modelId === 'custom' ? (
                <input
                  id="custom-model-id"
                  type="text"
                  value={customModelId}
                  onChange={(e) => setCustomModelId(e.target.value)}
                  placeholder="Enter custom Ollama model (e.g., llama3.2:latest)"
                  className="w-full px-3 py-2 bg-background dark:bg-[#202124] border border-input dark:border-[#5F6368] rounded-lg text-foreground dark:text-white text-[13px] placeholder:text-muted-foreground dark:placeholder:text-[#9AA0A6] focus:outline-none focus:border-primary dark:focus:border-[#8AB4F8] transition-colors"
                />
              ) : (
                <select
                  id="model-id"
                  value={modelId}
                  onChange={(e) => {
                    setModelId(e.target.value)
                    if (e.target.value === 'custom') {
                      setCustomModelId('')
                    }
                  }}
                  className="w-full px-3 py-2 bg-background dark:bg-[#202124] border border-input dark:border-[#5F6368] rounded-lg text-foreground dark:text-white text-[13px] focus:outline-none focus:border-primary dark:focus:border-[#8AB4F8] transition-colors appearance-none"
                  style={{
                    backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3e%3cpath fill='none' stroke='%239AA0A6' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M2 5l6 6 6-6'/%3e%3c/svg%3e")`,
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'right 0.5rem center',
                    backgroundSize: '1.25em 1.25em',
                    paddingRight: '2.5rem'
                  }}
                >
                  {MODEL_OPTIONS[providerType].map((model) => (
                    <option key={model} value={model} className="bg-background dark:bg-[#202124]">
                      {model}
                    </option>
                  ))}
                </select>
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
            <p className="text-[11px] text-muted-foreground dark:text-[#9AA0A6]">
              Your API key is encrypted and stored locally
            </p>
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
            className="px-4 py-2 text-[13px] font-medium text-white bg-primary dark:bg-[#8AB4F8] rounded-lg hover:bg-primary/90 dark:hover:bg-[#8AB4F8]/90 transition-colors disabled:opacity-50"
            disabled={isSaving}
          >
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
