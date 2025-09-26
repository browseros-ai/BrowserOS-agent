import React, { useMemo } from 'react'
import { Square, Check, Loader2, Minimize2, Camera } from 'lucide-react'
import { Button } from '@/sidepanel/components/ui/button'
import { useTeachModeStore } from './teachmode.store'
import { cn } from '@/sidepanel/lib/utils'
import { GroupedThinkingSection } from '@/sidepanel/components/GroupedThinkingSection'

export function TeachModeExecution() {
  const { activeRecording, executionProgress, setMode, executionMessages } = useTeachModeStore(state => ({
    activeRecording: state.activeRecording,
    executionProgress: state.executionProgress,
    setMode: state.setMode,
    executionMessages: state.executionMessages || []
  }))

  // Convert execution messages to format expected by GroupedThinkingSection
  const thinkingMessages = useMemo(() => {
    return executionMessages
      .filter(msg => msg.type === 'thinking')
      .map(msg => ({
        msgId: msg.msgId,  // Use the msgId from the store
        role: 'thinking' as const,
        content: msg.content,
        timestamp: new Date(msg.timestamp)
      }))
  }, [executionMessages])

  if (!activeRecording || !executionProgress) {
    return null
  }

  const handleStop = () => {
    // Stop execution and show partial results
    setMode('summary')
  }

  const handleMinimize = () => {
    // Minimize to background (future enhancement)
    console.log('Minimize execution')
  }

  const progressPercentage = Math.round(
    (executionProgress.currentStep / executionProgress.totalSteps) * 100
  )

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Status Bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-accent/50">
        <div className="flex items-center gap-2">
          <Loader2 className="w-4 h-4 text-primary animate-spin" />
          <span className="text-sm font-medium text-foreground">
            Running: {activeRecording.name}
          </span>
        </div>
        <Button
          onClick={handleStop}
          variant="destructive"
          size="sm"
          className="gap-1"
        >
          <Square className="w-3 h-3 fill-current" />
          Stop
        </Button>
      </div>

      {/* Progress */}
      <div className="px-4 py-3 border-b border-border">
        <div className="flex items-center justify-between text-sm mb-2">
          <span className="text-muted-foreground">
            Step {executionProgress.currentStep} of {executionProgress.totalSteps}
          </span>
          <span className="text-foreground font-medium">
            {progressPercentage}%
          </span>
        </div>
        <div className="h-2 bg-border rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-500 ease-out"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
      </div>

      {/* Thinking section */}
      {thinkingMessages.length > 0 && (
        <div className="px-4 py-3 border-b border-border">
          <GroupedThinkingSection
            messages={thinkingMessages}
            isLatest={true}
            isTaskCompleted={executionProgress.status === 'completed' || executionProgress.status === 'failed'}
          />
        </div>
      )}

      {/* Execution steps */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="space-y-3">
          {activeRecording.steps.map((step, index) => {
            const stepNumber = index + 1
            const isCompleted = stepNumber < executionProgress.currentStep
            const isCurrent = stepNumber === executionProgress.currentStep
            const isPending = stepNumber > executionProgress.currentStep
            const completedStep = executionProgress.completedSteps.find(
              (s) => s.stepNumber === stepNumber
            )

            return (
              <div
                key={step.id}
                className={cn(
                  "bg-background-alt rounded-lg p-3 border",
                  isCurrent ? "border-primary" : "border-border"
                )}
              >
                {/* Step header */}
                <div className="flex items-start gap-3">
                  {/* Status icon */}
                  <div className="mt-0.5">
                    {isCompleted ? (
                      <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
                        <Check className="w-3 h-3 text-white" />
                      </div>
                    ) : isCurrent ? (
                      <Loader2 className="w-5 h-5 text-primary animate-spin" />
                    ) : (
                      <div className="w-5 h-5 rounded-full bg-muted border-2 border-border" />
                    )}
                  </div>

                  {/* Step content */}
                  <div className="flex-1">
                    <div className={cn(
                      "text-sm font-medium",
                      isPending ? "text-muted-foreground" : "text-foreground"
                    )}>
                      {step.action.description}
                    </div>

                    {/* Completed message */}
                    {isCompleted && completedStep && (
                      <div className="text-xs text-muted-foreground mt-1">
                        {completedStep.message || `Completed in ${(completedStep.duration / 1000).toFixed(1)}s`}
                      </div>
                    )}

                    {/* Current step details */}
                    {isCurrent && (
                      <div className="mt-3 space-y-2">
                        {/* Current step message if available */}
                        {executionProgress.currentMessage && (
                          <div className="text-xs text-muted-foreground italic">
                            {executionProgress.currentMessage}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Minimize button */}
        <div className="mt-6 flex justify-center">
          <Button
            onClick={handleMinimize}
            variant="ghost"
            size="sm"
            className="gap-2"
          >
            <Minimize2 className="w-4 h-4" />
            Minimize
          </Button>
        </div>
      </div>
    </div>
  )
}