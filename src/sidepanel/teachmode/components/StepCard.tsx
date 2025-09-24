import React from 'react'
import { cn } from '@/sidepanel/lib/utils'
import { Camera } from 'lucide-react'
import type { CapturedEvent } from '../teachmode.types'
import { formatRelativeTime } from '../teachmode.utils'

interface StepCardProps {
  step: CapturedEvent
  isActive?: boolean
  showConnector?: boolean
}

export function StepCard({ step, isActive = false, showConnector = true }: StepCardProps) {
  return (
    <div className="relative">
      <div
        className={cn(
          "bg-background-alt rounded-lg p-3 border",
          isActive ? "border-primary animate-pulse" : "border-border"
        )}
      >
        {/* Step header */}
        <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
          <span>Step {step.stepNumber}</span>
          <span>•</span>
          <span>{isActive ? 'Recording...' : formatRelativeTime(step.timestamp)}</span>
        </div>

        {/* Step content */}
        <div className="flex gap-3">
          {/* Screenshot thumbnail */}
          <div className="w-12 h-9 bg-muted rounded flex items-center justify-center shrink-0">
            {step.screenshot ? (
              <img
                src={step.screenshot}
                alt="Screenshot"
                className="w-full h-full object-cover rounded"
              />
            ) : isActive ? (
              <div className="w-full h-full rounded bg-gradient-to-r from-primary/20 to-primary/30 animate-pulse" />
            ) : (
              <Camera className="w-4 h-4 text-muted-foreground" />
            )}
          </div>

          {/* Action details */}
          <div className="flex-1">
            <div className="text-sm font-medium text-foreground">
              {step.action.description}
            </div>
            {step.action.url && (
              <div className="text-xs text-muted-foreground">
                {step.action.url}
              </div>
            )}
            {step.action.element && (
              <div className="text-xs text-muted-foreground">
                {step.action.element}
              </div>
            )}
          </div>
        </div>

        {/* Voice annotation */}
        {step.voiceAnnotation && (
          <div className="mt-2 text-sm text-muted-foreground italic">
            💬 "{step.voiceAnnotation}"
          </div>
        )}
      </div>

      {/* Connector line */}
      {showConnector && (
        <div className="absolute left-1/2 -translate-x-1/2 top-full h-6 w-0.5 bg-border">
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-0 h-0
                        border-l-4 border-r-4 border-t-4
                        border-l-transparent border-r-transparent border-t-border" />
        </div>
      )}
    </div>
  )
}