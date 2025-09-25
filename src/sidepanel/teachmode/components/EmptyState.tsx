import React from 'react'
import { Wand2 } from 'lucide-react'
import { Button } from '@/sidepanel/components/ui/button'

interface EmptyStateProps {
  onCreateNew: () => void
}

export function EmptyState({ onCreateNew }: EmptyStateProps) {

  // Example workflows
  const EXAMPLES = [
    "📧 Unsubscribe from marketing emails",
    "📊 Extract data to spreadsheet",
    "🔍 Monitor website for changes",
    "🛍️ Find best deals on products"
  ]

  return (
    <div className="h-full overflow-y-auto flex flex-col items-center justify-center p-8 text-center relative">
      {/* Main content - vertically centered */}
      <div className="relative z-0 flex flex-col items-center justify-center min-h-0 max-w-lg w-full">

        {/* BrowserOS Branding */}
        <div className="flex items-center justify-center mb-6">
          <h2 className="text-3xl font-bold text-muted-foreground flex items-baseline flex-wrap justify-center gap-2 text-center px-2">
            <span>Teach</span>
            <span>
              <span className="text-brand">BrowserOS</span>
              <img
                src="/assets/browseros.svg"
                alt="BrowserOS"
                className="w-8 h-8 inline-block align-text-bottom ml-2"
              />
            </span>
          </h2>
        </div>

        {/* Subtitle */}
        <p className="text-lg text-muted-foreground mb-8">
          Show it once, automate forever
        </p>

        {/* Create Button */}
        <Button
          onClick={onCreateNew}
          size="lg"
          className="mb-10 gap-2"
        >
          <Wand2 className="w-5 h-5" />
          Create New Workflow
        </Button>

        {/* Example Workflows */}
        <div className="mb-8 mt-2 w-full">
          <h3 className="text-sm font-medium text-muted-foreground mb-4">
            ─────── Example Workflows ───────
          </h3>
          <div className="flex flex-col items-center max-w-lg w-full space-y-3">
            {EXAMPLES.map((example) => (
              <div
                key={example}
                className="relative w-full"
              >
                <div className="group relative text-sm py-3 px-4 whitespace-normal bg-background/50 backdrop-blur-sm border-2 border-border/30 rounded-lg hover:border-brand/50 hover:bg-brand/5 transition-all duration-300 w-full text-left">
                  <span className="text-muted-foreground group-hover:text-foreground transition-colors duration-300">
                    {example}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}