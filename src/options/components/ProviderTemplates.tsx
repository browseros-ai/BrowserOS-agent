import React, { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { LLMProvider } from '../types/llm-settings'
import { getModelsForProvider, getModelContextLength } from '../data/models'

interface ProviderTemplatesProps {
  onUseTemplate: (template: LLMProvider) => void
}

const getProviderIcon = (type: string) => {
  switch (type.toLowerCase()) {
    case 'openai':
      return (
        <div className="w-8 h-8 rounded-full bg-white dark:bg-white flex items-center justify-center p-1.5">
          <img src="/assets/openai.svg" alt="OpenAI" className="w-full h-full object-contain" />
        </div>
      )
    case 'claude':
    case 'anthropic':
      return (
        <div className="w-8 h-8 rounded-full bg-white dark:bg-white flex items-center justify-center p-1.5">
          <img src="/assets/anthropic.svg" alt="Anthropic" className="w-full h-full object-contain" />
        </div>
      )
    case 'gemini':
    case 'google_gemini':
      return (
        <div className="w-8 h-8 rounded-full bg-white dark:bg-white flex items-center justify-center p-1.5">
          <img src="/assets/Google-gemini-icon.svg" alt="Google Gemini" className="w-full h-full object-contain" />
        </div>
      )
    case 'ollama':
      return (
        <div className="w-8 h-8 rounded-full bg-white dark:bg-white flex items-center justify-center p-1.5">
          <img src="/assets/ollama.svg" alt="Ollama" className="w-full h-full object-contain" />
        </div>
      )
    case 'openrouter':
      return (
        <div className="w-8 h-8 rounded-full bg-white dark:bg-white flex items-center justify-center p-1.5">
          <img src="/assets/openrouter.svg" alt="OpenRouter" className="w-full h-full object-contain" />
        </div>
      )
    case 'lm studio':
    case 'openai_compatible':
      return (
        <div className="w-8 h-8 rounded-full bg-white dark:bg-white flex items-center justify-center p-1.5">
          <img src="/assets/lmstudio.svg" alt="LM Studio" className="w-full h-full object-contain" />
        </div>
      )
    default:
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/>
          <circle cx="12" cy="12" r="3"/>
        </svg>
      )
  }
}

// Helper to get default model and context for a provider type
const getProviderDefaults = (providerType: string) => {
  const models = getModelsForProvider(providerType)
  const defaultModel = models[0]?.modelId || ''
  const contextWindow = defaultModel ? getModelContextLength(providerType, defaultModel) || 128000 : 128000
  return { modelId: defaultModel, contextWindow }
}

const PROVIDER_TEMPLATES = [
  {
    name: 'OpenAI',
    type: 'openai',
    color: '#10A37F',
    template: (() => {
      const { modelId, contextWindow } = getProviderDefaults('openai')
      return {
        id: '',
        name: 'OpenAI',
        type: 'openai' as const,
        baseUrl: 'https://api.openai.com/v1',
        modelId,
        modelConfig: { contextWindow, temperature: 0.7 },
        isBuiltIn: false,
        isDefault: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    })()
  },
  {
    name: 'Claude',
    type: 'claude',
    color: '#7C3AED',
    template: (() => {
      const { modelId, contextWindow } = getProviderDefaults('anthropic')
      return {
        id: '',
        name: 'Claude',
        type: 'anthropic' as const,
        baseUrl: 'https://api.anthropic.com',
        modelId,
        modelConfig: { contextWindow, temperature: 0.7 },
        isBuiltIn: false,
        isDefault: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    })()
  },
  {
    name: 'Gemini',
    type: 'gemini',
    color: '#FFFFFF',
    template: (() => {
      const { modelId, contextWindow } = getProviderDefaults('google_gemini')
      return {
        id: '',
        name: 'Gemini',
        type: 'google_gemini' as const,
        modelId,
        modelConfig: { contextWindow, temperature: 0.7 },
        isBuiltIn: false,
        isDefault: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    })()
  },
  {
    name: 'Ollama',
    type: 'ollama',
    color: '#6B7280',
    template: (() => {
      const { modelId, contextWindow } = getProviderDefaults('ollama')
      return {
        id: '',
        name: 'Ollama',
        type: 'ollama' as const,
        baseUrl: 'http://localhost:11434',
        modelId,
        modelConfig: { contextWindow, temperature: 0.7 },
        isBuiltIn: false,
        isDefault: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    })()
  },
  {
    name: 'OpenRouter',
    type: 'openrouter',
    color: '#374151',
    template: (() => {
      const { modelId, contextWindow } = getProviderDefaults('openrouter')
      return {
        id: '',
        name: 'OpenRouter',
        type: 'openrouter' as const,
        baseUrl: 'https://openrouter.ai/api/v1',
        modelId,
        modelConfig: { contextWindow, temperature: 0.7 },
        isBuiltIn: false,
        isDefault: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    })()
  },
  {
    name: 'LM Studio',
    type: 'lm studio',
    color: '#3B82F6',
    template: (() => {
      const { modelId, contextWindow } = getProviderDefaults('openai_compatible')
      return {
        id: '',
        name: 'LM Studio',
        type: 'openai_compatible' as const,
        baseUrl: 'http://localhost:1234/v1',
        modelId,
        modelConfig: { contextWindow, temperature: 0.7 },
        isBuiltIn: false,
        isDefault: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    })()
  }
]

export function ProviderTemplates({ onUseTemplate }: ProviderTemplatesProps) {
  const [isExpanded, setIsExpanded] = useState(true)

  return (
    <section className="settings-card mb-8">
      <div className="px-5 py-6">
        {/* Section Header with Collapse */}
        <div
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center cursor-pointer hover:opacity-80 transition-opacity mb-5"
        >
          <ChevronDown
            className={`w-5 h-5 text-muted-foreground transition-transform mr-3 ${
              isExpanded ? 'rotate-0' : '-rotate-90'
            }`}
          />
          <div>
            <h3 className="text-[14px] font-medium text-foreground">
              Quick provider templates
            </h3>
            <span className="text-[12px] text-muted-foreground">
              6 templates available
            </span>
          </div>
        </div>

        {/* Templates Grid */}
        {isExpanded && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {PROVIDER_TEMPLATES.map((provider) => (
              <div
                key={provider.name}
                className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-accent/50 cursor-pointer transition-colors group"
                onClick={() => onUseTemplate(provider.template as LLMProvider)}
              >
                <div className="flex items-center gap-3">
                  {getProviderIcon(provider.type)}
                  <span className="text-[13px] font-normal">
                    {provider.name}
                  </span>
                </div>

                {/* USE Button */}
                <button
                  className="px-3 py-1 text-[11px] font-medium text-muted-foreground hover:text-foreground border border-border rounded hover:bg-background transition-colors uppercase"
                  onClick={(e) => {
                    e.stopPropagation()
                    onUseTemplate(provider.template as LLMProvider)
                  }}
                >
                  use
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}