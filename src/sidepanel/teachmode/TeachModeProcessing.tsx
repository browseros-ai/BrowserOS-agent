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

  // Calculate progress safely
  const currentStep = preprocessingStatus?.progress || 0
  const totalSteps = preprocessingStatus?.total || 0
  const progressPercent = totalSteps > 0
    ? Math.round((currentStep / totalSteps) * 100)
    : 0

  // Get current action type from structured data
  const currentAction = preprocessingStatus?.actionType || 'workflow'

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="px-4 py-4 border-b border-border/50 bg-background/95 backdrop-blur-sm">
        <div className="flex items-center justify-center">
          <h2 className="text-lg font-semibold text-muted-foreground flex items-center gap-1">
            <span>Processing</span>
            <span className="text-[hsl(var(--brand))]">BrowserOS</span>
            <span>Workflow</span>
          </h2>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="flex flex-col items-center justify-center h-full">
          {/* Icon */}
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 rounded-full bg-[hsl(var(--brand))]/10 flex items-center justify-center">
              <Zap className="w-8 h-8 text-[hsl(var(--brand))] animate-pulse" />
            </div>
          </div>

          {/* Title */}
          <h3 className="text-center text-lg font-medium text-foreground mb-6">
            Creating Your Automation
          </h3>

          {/* Progress Section - Always Visible */}
          <div className="w-full max-w-md space-y-4">
            {/* Step Counter and Percentage */}
            <div className="flex justify-between items-center text-sm">
              <span className="font-medium text-foreground">
                {totalSteps > 0 ? (
                  <>Step {currentStep} of {totalSteps}</>
                ) : (
                  <>Preparing...</>
                )}
              </span>
              <span className="text-muted-foreground">
                {progressPercent}% complete
              </span>
            </div>

            {/* Progress Bar - Always Visible */}
            <div className="relative h-3 w-full overflow-hidden rounded-full bg-muted/50 border border-border/50">
              <div
                className="h-full bg-gradient-to-r from-[hsl(var(--brand))] to-[hsl(var(--brand))]/80 transition-all duration-500 ease-out rounded-full"
                style={{
                  width: `${progressPercent || 5}%`,  // Minimum 5% for visibility
                  minWidth: progressPercent === 0 ? '20px' : undefined  // Small indicator even at 0%
                }}
              />
              {/* Shimmer effect for active processing */}
              {totalSteps > 0 && currentStep < totalSteps && (
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer" />
              )}
            </div>

            {/* Current Action */}
            <div className="text-center space-y-1">
              <div className="text-xs text-muted-foreground uppercase tracking-wide">
                Currently Processing
              </div>
              <div className="text-sm font-medium text-foreground flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="capitalize">
                  {preprocessingStatus ? currentAction : 'Initializing'} action
                </span>
              </div>
            </div>

            {/* Status Message */}
            {preprocessingStatus?.message && (
              <div className="text-center text-xs text-muted-foreground pt-2 opacity-70">
                {preprocessingStatus.message}
              </div>
            )}
          </div>

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