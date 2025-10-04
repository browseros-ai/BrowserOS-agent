import React from 'react'
import { BrowserOSProvider } from '@/lib/llm/settings/browserOSTypes'

interface ProviderCardProps {
  provider: BrowserOSProvider
  isDefault: boolean
  onEdit: () => void
  onDelete: () => void
  onSetDefault: () => void
}

export function ProviderCard({
  provider,
  isDefault,
  onEdit,
  onDelete,
  onSetDefault
}: ProviderCardProps) {
  // Get provider icon letter and color
  const getProviderStyle = () => {
    const styles: Record<string, { letter: string; bg: string; color: string }> = {
      browseros: { letter: 'B', bg: 'bg-purple-500', color: 'text-white' },
      openai: { letter: 'O', bg: 'bg-green-500', color: 'text-white' },
      anthropic: { letter: 'R', bg: 'bg-orange-500', color: 'text-white' },
      google_gemini: { letter: 'G', bg: 'bg-blue-500', color: 'text-white' },
      ollama: { letter: 'O', bg: 'bg-teal-500', color: 'text-white' },
      openrouter: { letter: 'A', bg: 'bg-amber-500', color: 'text-white' },
      openai_compatible: { letter: 'R', bg: 'bg-rose-500', color: 'text-white' },
      custom: { letter: 'C', bg: 'bg-gray-500', color: 'text-white' }
    }
    return styles[provider.type] || styles.custom
  }

  const style = getProviderStyle()

  return (
    <div className="bg-card border border-border rounded-lg p-4 hover:shadow-md transition-all hover:scale-[1.02]">
      {/* Header with icon and title */}
      <div className="flex items-start gap-3 mb-3">
        <div className={`w-10 h-10 rounded-lg ${style.bg} ${style.color} flex items-center justify-center font-bold text-lg`}>
          {style.letter}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="text-sm font-semibold text-foreground">{provider.name}</h4>
            {provider.isBuiltIn && (
              <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs rounded uppercase font-medium">
                BUILT-IN
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {provider.type === 'browseros'
              ? 'Automatically chooses the best model for each task'
              : `Model: ${provider.modelId || 'Not specified'}`}
          </p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-end gap-2 mt-3 pt-3 border-t border-border">
        <button
          onClick={onEdit}
          disabled={provider.isBuiltIn}
          className="px-3 py-1.5 text-xs font-medium text-foreground bg-secondary hover:bg-secondary/80 disabled:opacity-50 disabled:cursor-not-allowed rounded-md transition-colors"
        >
          Edit
        </button>
        {!isDefault && !provider.isBuiltIn && (
          <button
            onClick={onDelete}
            className="px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-md transition-colors"
          >
            Delete
          </button>
        )}
      </div>
    </div>
  )
}