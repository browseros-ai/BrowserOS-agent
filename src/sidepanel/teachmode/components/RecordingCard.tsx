import React, { useState, useRef, useEffect } from 'react'
import { cn } from '@/sidepanel/lib/utils'
import { Check, X } from 'lucide-react'
import type { TeachModeRecording } from '../teachmode.types'
import { formatDuration, formatRelativeTime, getSuccessRate } from '../teachmode.utils'

interface RecordingCardProps {
  recording: TeachModeRecording
  onClick: () => void
  onDelete: (id: string) => void
}

export function RecordingCard({ recording, onClick, onDelete }: RecordingCardProps) {
  const [showDelete, setShowDelete] = useState(false)
  const longPressTimer = useRef<NodeJS.Timeout | null>(null)
  const successRate = getSuccessRate(recording.successCount, recording.failureCount)
  const hasBeenRun = recording.runCount > 0

  const handleMouseDown = () => {
    longPressTimer.current = setTimeout(() => {
      setShowDelete(true)
    }, 500) // 500ms for long press
  }

  const handleMouseUp = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
    }
  }

  const handleMouseLeave = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
    }
  }

  const handleClick = (e: React.MouseEvent) => {
    if (showDelete) {
      e.stopPropagation()
      return
    }
    onClick()
  }

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (window.confirm(`Delete "${recording.name}"?`)) {
      onDelete(recording.id)
    }
    setShowDelete(false)
  }

  useEffect(() => {
    return () => {
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current)
      }
    }
  }, [])

  return (
    <div
      className={cn(
        "relative bg-background-alt rounded-lg p-4 cursor-pointer",
        "border border-border hover:border-primary/50",
        "transition-all duration-200",
        "select-none",
        showDelete && "border-destructive"
      )}
      onClick={handleClick}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleMouseDown}
      onTouchEnd={handleMouseUp}
    >
      {/* Delete overlay */}
      {showDelete && (
        <div className="absolute inset-0 bg-destructive/10 rounded-lg flex items-center justify-center z-10">
          <button
            onClick={handleDelete}
            className="bg-destructive text-white px-4 py-2 rounded-md font-medium"
          >
            Delete Workflow
          </button>
        </div>
      )}

      {/* Card content */}
      <div className={cn(showDelete && "opacity-50")}>
        {/* Title row */}
        <div className="flex items-start gap-2 mb-1">
          <span className="text-lg">{recording.icon}</span>
          <div className="flex-1">
            <h3 className="font-medium text-foreground">
              {recording.name}
            </h3>
            <p className="text-sm text-muted-foreground">
              {recording.description}
            </p>
          </div>
        </div>

        {/* Metadata */}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-3">
          <span>{recording.steps.length} steps</span>
          <span>•</span>
          <span>{formatDuration(recording.duration)}</span>
          <span>•</span>
          <span>{formatRelativeTime(recording.lastRunAt || recording.createdAt)}</span>
        </div>

        {/* Progress bar with status */}
        {hasBeenRun && (
          <div className="flex items-center gap-2 mt-3">
            <div className="flex-1 h-1 bg-border rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full transition-all duration-300",
                  successRate >= 80 ? "bg-green-500" :
                  successRate >= 50 ? "bg-yellow-500" :
                  "bg-destructive"
                )}
                style={{ width: `${successRate}%` }}
              />
            </div>
            {successRate >= 80 ? (
              <Check className="w-4 h-4 text-green-500" />
            ) : (
              <X className="w-4 h-4 text-destructive" />
            )}
          </div>
        )}
      </div>
    </div>
  )
}