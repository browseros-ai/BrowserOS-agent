import React from 'react'
import { cn } from '@/sidepanel/lib/utils'
import { Check, X, Play, Trash2 } from 'lucide-react'
import type { TeachModeRecording } from '../teachmode.types'
import { formatDuration, formatRelativeTime, getSuccessRate } from '../teachmode.utils'
import { Button } from '@/sidepanel/components/ui/button'

interface RecordingCardProps {
  recording: TeachModeRecording
  onClick: () => void
  onDelete: (id: string) => void | Promise<void>
  onRun: (id: string) => void | Promise<void>
}

export function RecordingCard({ recording, onClick, onDelete, onRun }: RecordingCardProps) {
  const successRate = getSuccessRate(recording.successCount, recording.failureCount)
  const hasBeenRun = recording.runCount > 0

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (window.confirm(`Delete "${recording.name}"?`)) {
      onDelete(recording.id)
    }
  }

  const handleRun = (e: React.MouseEvent) => {
    e.stopPropagation()
    onRun(recording.id)
  }

  return (
    <div
      className={cn(
        "relative bg-background-alt rounded-lg p-4 cursor-pointer",
        "border border-border hover:border-primary",
        "transition-all duration-200"
      )}
      onClick={onClick}
    >
      {/* Card content */}
      <div>
        {/* Title row with action buttons */}
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
          {/* Action buttons */}
          <div className="flex items-center gap-1">
            <Button
              onClick={handleRun}
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0"
              title="Run workflow"
            >
              <Play className="w-4 h-4" />
            </Button>
            <Button
              onClick={handleDelete}
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0 hover:bg-destructive/10 hover:text-destructive"
              title="Delete workflow"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
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