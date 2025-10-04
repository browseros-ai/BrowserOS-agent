import React, { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { LLMProvider } from '../types/llm-settings'

interface ProviderTemplatesProps {
  onUseTemplate: (template: LLMProvider) => void
}

const getProviderIcon = (type: string) => {
  switch (type.toLowerCase()) {
    case 'openai':
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: '24px', height: '24px' }}>
          <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872zm16.597 3.855l-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z"/>
        </svg>
      )
    case 'claude':
    case 'anthropic':
      return (
        <svg viewBox="0 0 24 24" fill="none" style={{ width: '24px', height: '24px' }}>
          <rect width="24" height="24" rx="4" fill="#CC9B7A"/>
          <path d="M10.5 7.5L7.5 16.5h1.8l0.6-1.8h2.4l0.6 1.8h1.8L12 7.5h-1.5zm-0.3 5.7l0.9-2.7 0.9 2.7h-1.8z" fill="#191918"/>
          <path d="M13.5 7.5L15 16.5h1.8l0.6-1.8h2.4l0.6 1.8h1.8L19.5 7.5H18zm0.3 5.7l0.9-2.7 0.9 2.7h-1.8z" fill="#191918"/>
        </svg>
      )
    case 'gemini':
    case 'google_gemini':
      return (
        <svg viewBox="0 0 24 24" fill="none" style={{ width: '24px', height: '24px' }}>
          <defs>
            <linearGradient id="gemini-grad-template" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#4285F4"/>
              <stop offset="25%" stopColor="#9B72CB"/>
              <stop offset="50%" stopColor="#D96570"/>
              <stop offset="75%" stopColor="#9B72CB"/>
              <stop offset="100%" stopColor="#4285F4"/>
            </linearGradient>
          </defs>
          <path d="M12 3.5L12 3.5C12.4 3.5 12.7 3.7 12.9 4C13.5 5 14.3 5.9 15.3 6.6C16.3 7.3 17.4 7.9 18.6 8.2C19 8.3 19.2 8.6 19.2 9C19.2 9.4 19 9.7 18.6 9.8C17.4 10.1 16.3 10.7 15.3 11.4C14.3 12.1 13.5 13 12.9 14C12.7 14.3 12.4 14.5 12 14.5C11.6 14.5 11.3 14.3 11.1 14C10.5 13 9.7 12.1 8.7 11.4C7.7 10.7 6.6 10.1 5.4 9.8C5 9.7 4.8 9.4 4.8 9C4.8 8.6 5 8.3 5.4 8.2C6.6 7.9 7.7 7.3 8.7 6.6C9.7 5.9 10.5 5 11.1 4C11.3 3.7 11.6 3.5 12 3.5Z" fill="url(#gemini-grad-template)" stroke="none"/>
          <path d="M17 13L17 13C17.3 13 17.5 13.2 17.6 13.4C17.9 14 18.4 14.5 18.9 14.9C19.4 15.3 20 15.6 20.6 15.8C20.9 15.9 21 16.1 21 16.4C21 16.7 20.9 16.9 20.6 17C20 17.2 19.4 17.5 18.9 17.9C18.4 18.3 17.9 18.8 17.6 19.4C17.5 19.6 17.3 19.8 17 19.8C16.7 19.8 16.5 19.6 16.4 19.4C16.1 18.8 15.6 18.3 15.1 17.9C14.6 17.5 14 17.2 13.4 17C13.1 16.9 13 16.7 13 16.4C13 16.1 13.1 15.9 13.4 15.8C14 15.6 14.6 15.3 15.1 14.9C15.6 14.5 16.1 14 16.4 13.4C16.5 13.2 16.7 13 17 13Z" fill="url(#gemini-grad-template)" stroke="none"/>
        </svg>
      )
    case 'ollama':
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: '24px', height: '24px' }}>
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/>
        </svg>
      )
    case 'openrouter':
      return (
        <svg viewBox="0 0 24 24" fill="none" style={{ width: '24px', height: '24px' }}>
          <path d="M4 8h16v2H4zm0 6h16v2H4z" fill="#8B5CF6"/>
          <circle cx="7" cy="9" r="1.5" fill="#A78BFA"/>
          <circle cx="12" cy="9" r="1.5" fill="#A78BFA"/>
          <circle cx="17" cy="9" r="1.5" fill="#A78BFA"/>
          <circle cx="7" cy="15" r="1.5" fill="#A78BFA"/>
          <circle cx="12" cy="15" r="1.5" fill="#A78BFA"/>
          <circle cx="17" cy="15" r="1.5" fill="#A78BFA"/>
        </svg>
      )
    case 'lm studio':
    case 'openai_compatible':
      return (
        <svg viewBox="0 0 24 24" fill="none" style={{ width: '24px', height: '24px' }}>
          <rect x="4" y="4" width="16" height="16" rx="3" fill="#6F42C1"/>
          <path d="M9 8h1.5v6H12v1.5H9V8zm4.5 0H15v6h1.5V8H18v1.5h-1.5v4.5c0 .8-.7 1.5-1.5 1.5h-1.5V8z" fill="white"/>
        </svg>
      )
    default:
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: '24px', height: '24px' }}>
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/>
          <circle cx="12" cy="12" r="3"/>
        </svg>
      )
  }
}

const PROVIDER_TEMPLATES = [
  {
    name: 'OpenAI',
    type: 'openai',
    color: '#10A37F',
    template: {
      id: '',
      name: 'OpenAI',
      type: 'openai' as const,
      baseUrl: 'https://api.openai.com/v1',
      isBuiltIn: false,
      isDefault: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  },
  {
    name: 'Claude',
    type: 'claude',
    color: '#7C3AED',
    template: {
      id: '',
      name: 'Claude',
      type: 'anthropic' as const,
      baseUrl: 'https://api.anthropic.com',
      isBuiltIn: false,
      isDefault: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  },
  {
    name: 'Gemini',
    type: 'gemini',
    color: '#FFFFFF',
    template: {
      id: '',
      name: 'Gemini',
      type: 'google_gemini' as const,
      isBuiltIn: false,
      isDefault: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  },
  {
    name: 'Ollama',
    type: 'ollama',
    color: '#6B7280',
    template: {
      id: '',
      name: 'Ollama',
      type: 'ollama' as const,
      baseUrl: 'http://localhost:11434',
      isBuiltIn: false,
      isDefault: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  },
  {
    name: 'OpenRouter',
    type: 'openrouter',
    color: '#374151',
    template: {
      id: '',
      name: 'OpenRouter',
      type: 'openrouter' as const,
      baseUrl: 'https://openrouter.ai/api/v1',
      isBuiltIn: false,
      isDefault: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  },
  {
    name: 'LM Studio',
    type: 'lm studio',
    color: '#3B82F6',
    template: {
      id: '',
      name: 'LM Studio',
      type: 'openai_compatible' as const,
      baseUrl: 'http://localhost:1234/v1',
      isBuiltIn: false,
      isDefault: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
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
                  <div className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center bg-muted">
                    {getProviderIcon(provider.type)}
                  </div>
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