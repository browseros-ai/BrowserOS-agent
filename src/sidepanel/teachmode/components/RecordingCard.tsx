import React, { useState } from 'react'
import { cn } from '@/sidepanel/lib/utils'
import { Check, X, Play, Trash2, AlertTriangle, Clock } from 'lucide-react'
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
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  const progressTone = !hasBeenRun
    ? 'muted'
    : successRate >= 80
      ? 'emerald'
      : successRate >= 50
        ? 'amber'
        : 'destructive'

  const progressColor =
    progressTone === 'emerald'
      ? 'bg-emerald-500'
      : progressTone === 'amber'
        ? 'bg-amber-500'
        : progressTone === 'destructive'
          ? 'bg-destructive'
          : 'bg-border'

  const StatusIcon =
    progressTone === 'emerald' ? Check : progressTone === 'amber' ? AlertTriangle : progressTone === 'muted' ? Clock : X
  const statusLabel = progressTone === 'emerald'
    ? 'Reliable'
    : progressTone === 'amber'
      ? 'In progress'
      : progressTone === 'destructive'
        ? 'Needs attention'
        : 'Not run yet'

  const handleDeleteTrigger = (e: React.MouseEvent) => {
    e.stopPropagation()
    setConfirmingDelete(true)
  }

  const handleRun = (e: React.MouseEvent) => {
    e.stopPropagation()
    onRun(recording.id)
  }

  const handleConfirmDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    onDelete(recording.id)
    setConfirmingDelete(false)
  }

  const handleCancelDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    setConfirmingDelete(false)
  }

  const handleCardClick = () => {
    if (confirmingDelete) {
      setConfirmingDelete(false)
      return
    }
    onClick()
  }

  return (
    <div
      className={cn(
        'relative cursor-pointer rounded-lg border border-border/70 bg-card px-4 py-4 shadow-sm',
        'transition-transform duration-150 hover:-translate-y-0.5 hover:shadow-md',
        confirmingDelete && 'border-destructive/40 bg-destructive/5'
      )}
      onClick={handleCardClick}
    >
      {/* Card content */}
      <div className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="text-xl leading-none">{recording.icon}</span>
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-foreground">
                {recording.name}
              </h3>
              <p className="text-xs text-muted-foreground">
                {recording.description}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Button
              onClick={handleRun}
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0 hover:text-primary"
              title="Run workflow"
            >
              <Play className="w-4 h-4" />
            </Button>
            <Button
              onClick={confirmingDelete ? handleCancelDelete : handleDeleteTrigger}
              size="sm"
              variant="ghost"
              className={cn(
                'h-8 w-8 p-0 rounded-md',
                confirmingDelete
                  ? 'border border-destructive/50 bg-destructive/10 text-destructive hover:bg-destructive/20'
                  : 'hover:bg-destructive/10 hover:text-destructive'
              )}
              title={confirmingDelete ? 'Cancel delete' : 'Delete workflow'}
            >
              {confirmingDelete ? (
                <X className="w-4 h-4" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <span>{recording.steps.length} steps</span>
            <span className="text-muted-foreground/40">•</span>
            <span>{formatDuration(recording.duration)}</span>
            <span className="text-muted-foreground/40">•</span>
            <span>{formatRelativeTime(recording.lastRunAt || recording.createdAt)}</span>
          </div>

          <div className="flex items-center gap-3">
            <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
              <div
                className={cn('h-full rounded-full transition-all duration-300', progressColor)}
                style={{ width: hasBeenRun ? `${successRate}%` : '0%' }}
              />
            </div>

            <div
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium',
                progressTone === 'muted'
                  ? 'bg-muted/80 text-muted-foreground'
                  :
                progressTone === 'emerald'
                  ? 'bg-emerald-50 text-emerald-700'
                  : progressTone === 'amber'
                    ? 'bg-amber-50 text-amber-700'
                    : 'bg-destructive/10 text-destructive'
              )}
            >
              <StatusIcon className="h-3.5 w-3.5" />
              <span>{statusLabel}</span>
            </div>
          </div>
        </div>
      </div>

      {confirmingDelete && (
        <div className="mt-3 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-sm font-semibold text-destructive">Delete this workflow?</span>
            <div className="flex items-center gap-2">
              <Button
                onClick={handleCancelDelete}
                size="sm"
                variant="outline"
                className="border-border text-muted-foreground hover:text-foreground"
              >
                Keep
              </Button>
              <Button
                onClick={handleConfirmDelete}
                size="sm"
                variant="destructive"
              >
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
