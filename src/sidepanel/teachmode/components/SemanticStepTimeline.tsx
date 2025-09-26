import React, { useState } from 'react'
import { ChevronDown, ChevronRight, Target, CheckCircle, Clock, MousePointer, Type, Navigation, Layers, Square } from 'lucide-react'
import { cn } from '@/sidepanel/lib/utils'
import type { SemanticWorkflow } from '@/lib/teach-mode/types'

interface SemanticStepTimelineProps {
  workflow: SemanticWorkflow | null
  loading?: boolean
  className?: string
}

// Map action types to icons
const getActionIcon = (actionType: string) => {
  switch (actionType.toLowerCase()) {
    case 'click':
    case 'dblclick':
      return <MousePointer className="w-3 h-3" />
    case 'input':
    case 'type':
      return <Type className="w-3 h-3" />
    case 'navigation':
    case 'navigate':
      return <Navigation className="w-3 h-3" />
    case 'tab_switched':
    case 'tab_opened':
    case 'tab_closed':
      return <Square className="w-3 h-3" />
    default:
      return <Layers className="w-3 h-3" />
  }
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
                  {/* Step number with gradient */}
                  <div className="flex items-center justify-center w-7 h-7 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 border border-primary/30 text-primary text-xs font-semibold shrink-0">
                    {index + 1}
                  </div>

                  {/* Step content */}
                  <div className="flex-1 min-w-0">
                    {/* Intent - The high-level goal */}
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground line-clamp-1">
                        {step.intent}
                      </span>
                    </div>

                    {/* Action description and metadata */}
                    <div className="flex items-center gap-3 mt-1.5">
                      {/* Action type icon and description */}
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        {getActionIcon(step.action.type)}
                        <span className="line-clamp-1">{step.action.description}</span>
                      </div>

                      {/* Timeout indicator */}
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        <span>{(step.action.timeoutMs / 1000).toFixed(1)}s</span>
                      </div>
                    </div>
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

              {/* Expanded details */}
              {isExpanded && (
                <div className="px-3 pb-3 border-t border-border/50">
                  <div className="mt-3 space-y-3">
                    {/* Action Type */}
                    <div className="grid grid-cols-2 gap-4 text-xs">
                      <div>
                        <span className="text-muted-foreground">Action Type</span>
                        <p className="text-foreground font-medium mt-0.5 capitalize">
                          {step.action.type.replace(/_/g, ' ')}
                        </p>
                      </div>

                      <div>
                        <span className="text-muted-foreground">Timeout</span>
                        <p className="text-foreground font-medium mt-0.5">
                          {step.action.timeoutMs}ms
                        </p>
                      </div>
                    </div>

                    {/* Element Identification Strategy */}
                    {step.action.nodeIdentificationStrategy && (
                      <div className="text-xs">
                        <span className="text-muted-foreground">Element Identification</span>
                        <p className="text-foreground mt-1 p-2 bg-muted/50 rounded font-mono text-xs">
                          {step.action.nodeIdentificationStrategy}
                        </p>
                      </div>
                    )}

                    {/* Validation Strategy */}
                    <div className="text-xs">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" />
                        Validation Strategy
                      </span>
                      <p className="text-foreground mt-1 p-2 bg-muted/50 rounded">
                        {step.action.validationStrategy}
                      </p>
                    </div>

                    {/* Source Events Reference */}
                    {step.sourceEventIds && step.sourceEventIds.length > 0 && (
                      <div className="text-xs">
                        <span className="text-muted-foreground">
                          Based on {step.sourceEventIds.length} recorded {step.sourceEventIds.length === 1 ? 'event' : 'events'}
                        </span>
                      </div>
                    )}
                  </div>
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

      {/* Workflow Summary */}
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