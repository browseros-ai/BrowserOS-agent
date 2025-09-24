import React, { useState, useEffect } from 'react'
import { Zap } from 'lucide-react'
import { Button } from '@/sidepanel/components/ui/button'
import { ProcessingStages } from './components/ProcessingStages'
import { useTeachModeStore } from './teachmode.store'

export function TeachModeProcessing() {
  const { recordingEvents, setMode } = useTeachModeStore()
  const [progress, setProgress] = useState(0)
  const [currentStage, setCurrentStage] = useState(0)

  useEffect(() => {
    // Simulate processing progress
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval)
          return 100
        }
        return prev + 5
      })
    }, 150)

    // Update stages
    const stageTimer = setTimeout(() => setCurrentStage(1), 1000)
    const stageTimer2 = setTimeout(() => setCurrentStage(2), 2000)

    return () => {
      clearInterval(interval)
      clearTimeout(stageTimer)
      clearTimeout(stageTimer2)
    }
  }, [])

  const handleCancel = () => {
    // Cancel processing and return to home
    setMode('idle')
  }

  const stages = [
    {
      id: 'capture',
      label: `Captured ${recordingEvents.length} actions`,
      sublabel: 'with voice annotations',
      status: 'completed' as const
    },
    {
      id: 'analyze',
      label: 'Analyzed page interactions',
      sublabel: 'and UI elements',
      status: currentStage >= 1 ? 'completed' as const : 'pending' as const
    },
    {
      id: 'understand',
      label: 'Understanding workflow intent...',
      status: currentStage >= 2 ? 'active' as const : 'pending' as const,
      progress: currentStage >= 2 ? progress : undefined
    },
    {
      id: 'create',
      label: 'Creating adaptable automation',
      status: 'pending' as const
    },
    {
      id: 'optimize',
      label: 'Optimizing for reliability',
      status: 'pending' as const
    }
  ]

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="px-4 py-4 border-b border-border">
        <h2 className="text-lg font-semibold text-foreground">
          Processing Your Workflow
        </h2>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        {/* Icon */}
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Zap className="w-8 h-8 text-primary animate-pulse" />
          </div>
        </div>

        {/* Title */}
        <h3 className="text-center text-lg font-medium text-foreground mb-8">
          Creating Your Automation
        </h3>

        {/* Processing stages */}
        <ProcessingStages stages={stages} />

        {/* Time estimate */}
        <div className="mt-8 text-center text-sm text-muted-foreground">
          This usually takes 10-20 seconds
        </div>

        {/* Cancel button */}
        <div className="mt-6 flex justify-center">
          <Button
            onClick={handleCancel}
            variant="ghost"
            size="sm"
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  )
}