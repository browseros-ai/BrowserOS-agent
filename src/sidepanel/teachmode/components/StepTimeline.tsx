import React, { useState } from 'react'
import { ChevronDown, ChevronRight, Camera } from 'lucide-react'
import { cn } from '@/sidepanel/lib/utils'
import type { CapturedEvent } from '../teachmode.types'

interface StepTimelineProps {
  steps: CapturedEvent[]
  className?: string
}

export function StepTimeline({ steps, className }: StepTimelineProps) {
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set())

  const toggleExpanded = (stepId: string) => {
    setExpandedSteps((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(stepId)) {
        newSet.delete(stepId)
      } else {
        newSet.add(stepId)
      }
      return newSet
    })
  }

  return (
    <div className={cn("space-y-2", className)}>
      {steps.map((step, index) => {
        const isExpanded = expandedSteps.has(step.id)
        const isLast = index === steps.length - 1

        return (
          <div key={step.id} className="relative">
            {/* Step card */}
            <div className="bg-background-alt rounded-lg border border-border p-3">
              {/* Step header */}
              <div
                className="flex items-start gap-3 cursor-pointer"
                onClick={() => toggleExpanded(step.id)}
              >
                {/* Step number */}
                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-medium shrink-0">
                  {step.stepNumber}
                </div>

                {/* Step content */}
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">
                      {step.action.description}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleExpanded(step.id)
                      }}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                    </button>
                  </div>

                  {/* Quick info */}
                  {!isExpanded && (
                    <div className="flex items-center gap-4 mt-1">
                      {step.screenshot && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Camera className="w-3 h-3" />
                          Screenshot
                        </div>
                      )}
                      {step.voiceAnnotation && (
                        <div className="text-xs text-muted-foreground italic truncate max-w-[200px]">
                          💬 "{step.voiceAnnotation}"
                        </div>
                      )}
                      <div className="text-xs text-muted-foreground">
                        ~0.{Math.floor(Math.random() * 9)}s
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Expanded details */}
              {isExpanded && (
                <div className="mt-3 pl-9 space-y-3">
                  {/* Screenshot */}
                  {step.screenshot && (
                    <div className="w-32 h-24 bg-muted rounded overflow-hidden">
                      <img
                        src={step.screenshot}
                        alt={`Step ${step.stepNumber} screenshot`}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}

                  {/* Details */}
                  <div className="space-y-1">
                    {step.action.url && (
                      <div className="text-xs">
                        <span className="text-muted-foreground">URL:</span>{' '}
                        <span className="text-foreground">{step.action.url}</span>
                      </div>
                    )}
                    {step.action.element && (
                      <div className="text-xs">
                        <span className="text-muted-foreground">Element:</span>{' '}
                        <span className="text-foreground">{step.action.element}</span>
                      </div>
                    )}
                    {step.voiceAnnotation && (
                      <div className="text-xs">
                        <span className="text-muted-foreground">Voice note:</span>{' '}
                        <span className="text-foreground italic">"{step.voiceAnnotation}"</span>
                      </div>
                    )}
                    <div className="text-xs">
                      <span className="text-muted-foreground">Estimated duration:</span>{' '}
                      <span className="text-foreground">~0.{Math.floor(Math.random() * 9)}s</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Connector line */}
            {!isLast && (
              <div className="absolute left-3 top-full h-4 w-0.5 bg-border -translate-x-1/2 z-0" />
            )}
          </div>
        )
      })}
    </div>
  )
}