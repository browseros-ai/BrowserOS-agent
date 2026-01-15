import { Workflow } from 'lucide-react'
import type { FC } from 'react'
import { cn } from '@/lib/utils'

interface Suggestion {
  display: string
  prompt: string
  icon: string
}

const WORKFLOW_SUGGESTIONS: Suggestion[] = [
  {
    display: 'Search Amazon and add toothpaste to cart',
    prompt:
      'Go to Amazon, search for toothpaste, select 1 pack filter and add the first result to cart',
    icon: '🛒',
  },
  {
    display: 'Accept LinkedIn connection requests',
    prompt:
      'Open LinkedIn and go to my connection requests, accept one by one in a loop for 25 times',
    icon: '🤝',
  },
  {
    display: 'Unsubscribe from Gmail subscriptions',
    prompt:
      'Go to Gmail, navigate to manage subscriptions and unsubscribe from all',
    icon: '📧',
  },
]

interface GraphEmptyStateProps {
  mounted: boolean
  onSuggestionClick: (prompt: string) => void
}

export const GraphEmptyState: FC<GraphEmptyStateProps> = ({
  mounted,
  onSuggestionClick,
}) => {
  return (
    <div
      className={cn(
        'm-0! flex h-full flex-col items-center justify-center space-y-4 text-center opacity-0 transition-all duration-700',
        mounted ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0',
      )}
    >
      <div className="mb-2 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/50">
        <Workflow className="h-7 w-7 text-[var(--accent-orange)]" />
      </div>
      <div>
        <h2 className="mb-1 font-semibold text-lg">
          Create reliable workflows
        </h2>
        <p className="max-w-[240px] text-muted-foreground text-xs">
          Chat with the agent to create and refine browser automation
        </p>
      </div>

      <div className="mt-6 grid w-full max-w-[300px] grid-cols-1 gap-2">
        {WORKFLOW_SUGGESTIONS.map((suggestion) => (
          <button
            type="button"
            key={suggestion.display}
            onClick={() => onSuggestionClick(suggestion.prompt)}
            className="group flex items-center justify-between rounded-lg border border-border/50 bg-card px-3 py-2.5 text-left text-xs transition-all duration-200 hover:border-[var(--accent-orange)]/50 hover:bg-[var(--accent-orange)]/5"
          >
            {suggestion.display}
            <span className="opacity-0 transition-opacity duration-200 group-hover:opacity-100">
              {suggestion.icon}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
