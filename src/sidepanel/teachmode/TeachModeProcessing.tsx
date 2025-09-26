import React from 'react'
import { Zap, Loader2 } from 'lucide-react'
import { Button } from '@/sidepanel/components/ui/button'
import { useTeachModeStore } from './teachmode.store'

export function TeachModeProcessing() {
  const { setMode, preprocessingStatus } = useTeachModeStore()

  const handleCancel = () => {
    // Cancel processing and return to home
    setMode('idle')
  }

  const progressPercent = preprocessingStatus && preprocessingStatus.total > 0
    ? Math.round((preprocessingStatus.progress / preprocessingStatus.total) * 100)
    : 0

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="px-4 py-4 border-b border-border">
        <h2 className="text-lg font-semibold text-foreground">
          Processing Your Workflow
        </h2>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="flex flex-col items-center justify-center h-full">
          {/* Icon */}
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Zap className="w-8 h-8 text-primary animate-pulse" />
            </div>
          </div>

          {/* Title */}
          <h3 className="text-center text-lg font-medium text-foreground mb-4">
            Creating Your Automation
          </h3>

          {/* Progress indicator */}
          {preprocessingStatus && (
            <div className="w-full max-w-sm space-y-4">
              {/* Progress message */}
              <div className="text-center text-sm text-muted-foreground">
                {preprocessingStatus.message}
              </div>

              {/* Progress bar */}
              {preprocessingStatus.total > 0 && (
                <div className="space-y-2">
                  <div className="relative h-2 w-full overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full bg-primary transition-all duration-300 ease-out"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                  <div className="text-center text-xs text-muted-foreground">
                    {preprocessingStatus.progress} of {preprocessingStatus.total} events processed
                  </div>
                </div>
              )}

              {/* Loading spinner */}
              <div className="flex justify-center mt-4">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            </div>
          )}

          {/* If no status yet */}
          {!preprocessingStatus && (
            <div className="text-center text-sm text-muted-foreground">
              <div className="mb-4">Saving your recording...</div>
              <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" />
            </div>
          )}

          {/* Cancel button */}
          <div className="mt-8">
            <Button
              onClick={handleCancel}
              variant="ghost"
              size="sm"
            >
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}