import React from 'react'
import { ArrowLeft, Play, MoreVertical, Calendar } from 'lucide-react'
import { Button } from '@/sidepanel/components/ui/button'
import { StepTimeline } from './components/StepTimeline'
import { useTeachModeStore } from './teachmode.store'
import { formatDuration, formatTime, getSuccessRate } from './teachmode.utils'

export function TeachModeDetail() {
  const { activeRecording, setMode, executeRecording } = useTeachModeStore()

  if (!activeRecording) {
    return null
  }

  const handleBack = () => {
    setMode('idle')
  }

  const handleRunNow = () => {
    executeRecording(activeRecording.id)
  }

  const handleSchedule = () => {
    // Future enhancement
    console.log('Schedule workflow')
  }

  const handleOptions = () => {
    // Show options menu (rename, delete, export, etc.)
    console.log('Show options')
  }

  const successRate = getSuccessRate(activeRecording.successCount, activeRecording.failureCount)

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-header">
        <div className="flex items-center gap-3">
          <button
            onClick={handleBack}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <span className="text-sm font-medium text-foreground">
            {activeRecording.name}
          </span>
        </div>
        <button
          onClick={handleOptions}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <MoreVertical className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Action buttons */}
        <div className="p-4 space-y-2">
          <Button
            onClick={handleRunNow}
            className="w-full gap-2"
            size="lg"
          >
            <Play className="w-4 h-4" />
            Run Now
          </Button>

          <Button
            onClick={handleSchedule}
            variant="outline"
            className="w-full gap-2"
            disabled
          >
            <Calendar className="w-4 h-4" />
            Schedule
            <span className="text-xs text-muted-foreground ml-auto">Coming soon</span>
          </Button>
        </div>

        <div className="border-t border-border">
          {/* Workflow steps */}
          <div className="p-4">
            <h3 className="text-sm font-medium text-foreground mb-3">
              Workflow Steps
            </h3>
            <StepTimeline steps={activeRecording.steps} />
          </div>

          {/* Metadata section */}
          <div className="border-t border-border p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Created</span>
              <span className="text-foreground">
                {formatTime(activeRecording.createdAt)}
              </span>
            </div>

            {activeRecording.lastRunAt && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Last run</span>
                <span className="text-foreground">
                  {formatTime(activeRecording.lastRunAt)} ({activeRecording.runCount > 0 ? 'Success' : 'Not run'})
                </span>
              </div>
            )}

            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total runs</span>
              <span className="text-foreground">{activeRecording.runCount}</span>
            </div>

            {activeRecording.runCount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Success rate</span>
                <span className="text-foreground">{successRate}%</span>
              </div>
            )}

            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Avg duration</span>
              <span className="text-foreground">
                {formatDuration(activeRecording.duration)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}