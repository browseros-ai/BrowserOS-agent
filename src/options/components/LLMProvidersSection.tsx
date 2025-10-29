import React from 'react'
import { Plus } from 'lucide-react'
import { LLMProvider } from '../types/llm-settings'

interface LLMProvidersSectionProps {
  defaultProvider: string
  providers: LLMProvider[]
  onDefaultChange: (provider: string) => void
  onAddProvider: () => void
}

export function LLMProvidersSection({
  defaultProvider,
  providers,
  onDefaultChange,
  onAddProvider
}: LLMProvidersSectionProps) {
  return (
    <section className="bg-card rounded-lg px-6 py-5 mb-8 border border-border shadow-sm">
      <div className="flex items-start gap-4 mb-6">
        {/* BrowserOS Logo */}
        <div className="w-12 h-12 rounded-full bg-brand flex items-center justify-center flex-shrink-0 overflow-hidden shadow-md">
          <img
            src="/assets/browseros.svg"
            alt="BrowserOS"
            className="w-10 h-10 object-contain"
          />
        </div>

        {/* Header Text */}
        <div className="flex-1">
          <h2 className="text-foreground text-[18px] font-medium leading-tight mb-1">
            LLM Providers
          </h2>
          <p className="text-muted-foreground text-[14px] leading-normal">
            Add your provider and choose the default LLM
          </p>
        </div>
      </div>

      {/* Controls Row */}
      <div className="flex items-center gap-4">
        {/* Default Provider Selector */}
        <div className="flex items-center gap-3">
          <label htmlFor="default-provider" className="text-foreground text-[14px] font-normal">
            Default Provider:
          </label>
          <div className="relative">
            <select
              id="default-provider"
              value={defaultProvider}
              onChange={(e) => onDefaultChange(e.target.value)}
              className="appearance-none bg-background border border-input rounded-lg px-4 py-2 pr-10 text-foreground text-[14px] min-w-[200px] hover:bg-accent focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand/20 transition-all cursor-pointer"
            >
              {providers.filter(p => p && p.id && p.name).map((provider) => (
                <option key={provider.id} value={provider.id} className="bg-background">
                  {provider.name}
                </option>
              ))}
            </select>
            {/* Custom Dropdown Arrow */}
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
              <svg width="12" height="8" viewBox="0 0 12 8" fill="none">
                <path d="M1 1.5L6 6.5L11 1.5" stroke="currentColor" className="text-muted-foreground" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          </div>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Add Custom Provider Button */}
        <button
          onClick={onAddProvider}
          className="flex items-center gap-2 px-5 py-2 bg-transparent border-2 border-brand/30 text-foreground rounded-lg hover:border-brand hover:bg-brand/5 hover:text-brand transition-all text-[14px] font-medium"
        >
          <Plus className="w-5 h-5" strokeWidth={2} />
          <span>Add custom provider</span>
        </button>
      </div>
    </section>
  )
}