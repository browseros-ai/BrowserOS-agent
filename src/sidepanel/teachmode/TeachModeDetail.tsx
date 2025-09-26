import React, { useEffect, useState } from 'react'
import { Play, MoreVertical, Calendar, ArrowLeft } from 'lucide-react'
import { Button } from '@/sidepanel/components/ui/button'
import { SemanticStepTimeline } from './components/SemanticStepTimeline'
import { useTeachModeStore } from './teachmode.store'
import { formatTime } from './teachmode.utils'
import type { SemanticWorkflow } from '@/lib/teach-mode/types'

export function TeachModeDetail() {
  const { activeRecording, setMode, executeRecording, getWorkflow, activeWorkflow } = useTeachModeStore()
  const [workflow, setWorkflow] = useState<SemanticWorkflow | null>(null)
  const [loadingWorkflow, setLoadingWorkflow] = useState(false)

  // Fetch workflow when activeRecording changes
  useEffect(() => {
    if (!activeRecording) return

    // Use cached workflow if available
    if (activeWorkflow && activeWorkflow.metadata.recordingId === activeRecording.id) {
      setWorkflow(activeWorkflow)
      return
    }

    // Fetch workflow from backend
    const fetchWorkflow = async () => {
      setLoadingWorkflow(true)
      try {
        const fetchedWorkflow = await getWorkflow(activeRecording.id)
        setWorkflow(fetchedWorkflow)
      } catch (error) {
        console.error('Failed to fetch workflow:', error)
        setWorkflow(null)
      } finally {
        setLoadingWorkflow(false)
      }
    }

    fetchWorkflow()
  }, [activeRecording, getWorkflow, activeWorkflow])

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

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Internal navigation */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border">
        <button
          onClick={handleBack}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors p-1"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Workflows</span>
        </button>
        <button
          onClick={handleOptions}
          className="text-muted-foreground hover:text-foreground transition-colors p-1"
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
            <SemanticStepTimeline
              workflow={workflow}
              loading={loadingWorkflow}
            />
          </div>

          {/* Metadata section - minimal */}
          <div className="border-t border-border p-4">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Created</span>
              <span className="text-foreground">
                {formatTime(activeRecording.createdAt)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}