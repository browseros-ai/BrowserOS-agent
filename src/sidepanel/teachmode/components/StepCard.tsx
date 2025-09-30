import React from 'react'
import { cn } from '@/sidepanel/lib/utils'
import { Camera, Globe, MousePointer, Type, ArrowUpDown, Image } from 'lucide-react'
import type { CapturedEvent } from '../teachmode.types'
import { formatRelativeTime } from '../teachmode.utils'

interface StepCardProps {
  step: CapturedEvent
  isActive?: boolean
  showConnector?: boolean
}

// Get appropriate icon based on action type
const getActionIcon = (description: string) => {
  const lowerDesc = description.toLowerCase()
  if (lowerDesc.includes('navigate')) return Globe
  if (lowerDesc.includes('click')) return MousePointer
  if (lowerDesc.includes('type') || lowerDesc.includes('key')) return Type
  if (lowerDesc.includes('scroll')) return ArrowUpDown
  if (lowerDesc.includes('screenshot')) return Camera
  if (lowerDesc.includes('switch')) return ArrowUpDown
  return MousePointer
}

// Format action description for cleaner display
const formatActionDescription = (step: CapturedEvent) => {
  const desc = step.action.description

  // For navigation, show domain only
  if (desc.toLowerCase().includes('navigated to') && step.action.url) {
    try {
      const url = new URL(step.action.url)
      return `Navigated to ${url.hostname}`
    } catch {
      return desc
    }
  }

  // For clicks, simplify element description if too long
  if (desc.toLowerCase().includes('clicked') && step.action.element) {
    const element = step.action.element
    if (element.length > 30) {
      return `Clicked element`
    }
  }

  return desc
}

export function StepCard({ step, isActive = false, showConnector = true }: StepCardProps) {
  const ActionIcon = getActionIcon(step.action.description)
  const formattedDescription = formatActionDescription(step)

  return (
    <div className="relative group">
      <div
        className={cn(
          "bg-background-alt border rounded-lg transition-all duration-200 hover:shadow-sm",
          isActive ? "border-primary animate-pulse" : "border-border hover:border-border/80"
        )}
      >
        {/* Compact card content */}
        <div className="flex items-center gap-3 p-3">
          {/* Step indicator with icon */}
          <div className="flex items-center gap-2 shrink-0">
            <div className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium",
              isActive ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
            )}>
              {step.stepNumber}
            </div>
            <div className={cn(
              "w-8 h-8 rounded flex items-center justify-center",
              isActive ? "text-primary" : "text-muted-foreground"
            )}>
              <ActionIcon className="w-4 h-4" />
            </div>
          </div>

          {/* Action summary */}
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-foreground truncate">
              {formattedDescription}
            </div>
            {/* Show element or additional context if available */}
            {step.action.element && step.action.element.length <= 30 && (
              <div className="text-xs text-muted-foreground truncate mt-0.5">
                {step.action.element}
              </div>
            )}
          </div>

          {/* Thumbnail and timestamp */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Screenshot thumbnail if available */}
            {step.screenshot && (
              <div className="w-12 h-12 bg-muted rounded overflow-hidden border border-border">
                <img
                  src={step.screenshot}
                  alt=""
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            {/* Timestamp */}
            <span className="text-xs text-muted-foreground">
              {isActive ? 'now' : formatRelativeTime(step.timestamp)}
            </span>
          </div>
        </div>

        {/* Voice annotation - shown as a subtle strip if present */}
        {step.voiceAnnotation && (
          <div className="px-3 pb-2">
            <div className="text-xs text-muted-foreground bg-muted rounded px-2 py-1 italic">
              💬 {step.voiceAnnotation.length > 60
                ? step.voiceAnnotation.substring(0, 60) + '...'
                : step.voiceAnnotation}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}