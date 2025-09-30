import React, { useState } from 'react'
import { ChevronDown, ChevronRight, Target } from 'lucide-react'
import { cn } from '@/sidepanel/lib/utils'
import type { SemanticWorkflow } from '@/lib/teach-mode/types'

interface SemanticStepTimelineProps {
  workflow: SemanticWorkflow | null
  loading?: boolean
  className?: string
}

// Format action type for display
const formatActionType = (actionType: string) => {
  return actionType
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

export function SemanticStepTimeline({ workflow, loading, className }: SemanticStepTimelineProps) {
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

  // Loading state
  if (loading) {
    return (
      <div className={cn("space-y-2", className)}>
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-muted/50 rounded-lg p-3 animate-pulse">
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 bg-muted rounded-full" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-muted rounded w-3/4" />
                <div className="h-3 bg-muted rounded w-1/2" />
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  // No workflow state
  if (!workflow || !workflow.steps || workflow.steps.length === 0) {
    return (
      <div className={cn("text-center py-8", className)}>
        <div className="text-sm text-muted-foreground">
          No workflow steps available
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          The workflow may still be processing
        </p>
      </div>
    )
  }

  return (
    <div className={cn("space-y-2", className)}>
      {/* Workflow Goal */}
      {workflow.metadata.goal && (
        <div className="mb-4 p-3 bg-primary/5 border border-primary/20 rounded-lg">
          <div className="flex items-start gap-2">
            <Target className="w-4 h-4 text-primary mt-0.5" />
            <div>
              <p className="text-sm font-medium text-foreground">Workflow Goal</p>
              <p className="text-xs text-muted-foreground mt-1">{workflow.metadata.goal}</p>
            </div>
          </div>
        </div>
      )}

      {/* Steps */}
      {workflow.steps.map((step, index) => {
        const isExpanded = expandedSteps.has(step.id)
        const isLast = index === workflow.steps.length - 1

        return (
          <div key={step.id} className="relative">
            {/* Step card */}
            <div className="bg-card rounded-lg border border-border hover:border-primary/30 transition-colors">
              {/* Step header */}
              <div
                className="p-3 cursor-pointer"
                onClick={() => toggleExpanded(step.id)}
              >
                <div className="flex items-start gap-3">
                  {/* Step number */}
                  <div className="flex items-center justify-center w-7 h-7 rounded-full bg-primary/10 text-primary text-xs font-semibold shrink-0">
                    {index + 1}
                  </div>

                  {/* Step content */}
                  <div className="flex-1 min-w-0">
                    {/* Action Type as main title */}
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">
                        {formatActionType(step.action.type)}
                      </span>
                    </div>

                    {/* Action description preview - only when collapsed */}
                    {!isExpanded && (
                      <div className="mt-1">
                        <span className="text-xs text-muted-foreground line-clamp-1">
                          {step.action.description}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Expand/Collapse button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleExpanded(step.id)
                    }}
                    className="text-muted-foreground hover:text-foreground transition-colors p-1"
                  >
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Expanded details - just the description */}
              {isExpanded && (
                <div className="px-3 pb-3 pl-12">
                  <p className="text-sm text-foreground">
                    {step.action.description}
                  </p>
                </div>
              )}
            </div>

            {/* Connector line */}
            {!isLast && (
              <div className="absolute left-3.5 top-full h-4 w-0.5 bg-gradient-to-b from-border to-transparent -translate-x-1/2 z-0" />
            )}
          </div>
        )
      })}

      {/* Minimal footer - just total steps and estimated duration */}
      <div className="mt-4 pt-4 border-t border-border">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Total Steps: {workflow.steps.length}</span>
          {workflow.metadata.duration && (
            <span>Estimated Duration: {Math.ceil(workflow.metadata.duration / 1000)}s</span>
          )}
        </div>
      </div>
    </div>
  )
}