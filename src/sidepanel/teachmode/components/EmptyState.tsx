import React from 'react'
import { Wand2 } from 'lucide-react'
import { Button } from '@/sidepanel/components/ui/button'

interface EmptyStateProps {
  onCreateNew: () => void
}

export function EmptyState({ onCreateNew }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full px-6 py-12">
      {/* Icon */}
      <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-6">
        <Wand2 className="w-8 h-8 text-primary" />
      </div>

      {/* Title */}
      <h2 className="text-xl font-semibold text-foreground mb-2">
        Teach Nxtscape Your Workflows
      </h2>

      {/* Description */}
      <p className="text-sm text-muted-foreground text-center mb-8 max-w-[280px]">
        Show Nxtscape how to do something once, and it learns to do it for you automatically.
      </p>

      {/* Primary Action */}
      <Button
        onClick={onCreateNew}
        className="mb-8"
        size="lg"
      >
        Create New Workflow
      </Button>

      {/* Examples Section */}
      <div className="w-full">
        <div className="text-xs text-muted-foreground text-center mb-3">
          ─────────── Examples ───────────
        </div>
        <ul className="space-y-2">
          <li className="text-sm text-muted-foreground">
            • Unsubscribe from emails
          </li>
          <li className="text-sm text-muted-foreground">
            • Extract data to spreadsheet
          </li>
          <li className="text-sm text-muted-foreground">
            • Check website for updates
          </li>
        </ul>
      </div>
    </div>
  )
}