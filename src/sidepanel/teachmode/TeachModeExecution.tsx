import React, { useMemo, useState, useEffect } from 'react'
import { Square, Loader2, CheckCircle, AlertCircle, RefreshCw, Home, ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '@/sidepanel/components/ui/button'
import { useTeachModeStore } from './teachmode.store'
import { GroupedThinkingSection } from '@/sidepanel/components/GroupedThinkingSection'
import { formatDuration } from './teachmode.utils'
import { cn } from '@/sidepanel/lib/utils'

export function TeachModeExecution() {
  const {
    activeRecording,
    executionProgress,
    executionSummary,
    abortExecution,
    executionMessages,
    executeRecording,
    setMode
  } = useTeachModeStore(state => ({
    activeRecording: state.activeRecording,
    executionProgress: state.executionProgress,
    executionSummary: state.executionSummary,
    abortExecution: state.abortExecution,
    executionMessages: state.executionMessages || [],
    executeRecording: state.executeRecording,
    setMode: state.setMode
  }))

  const [isThinkingExpanded, setIsThinkingExpanded] = useState(true)

  // Auto-collapse thinking when execution completes
  useEffect(() => {
    if (executionProgress?.status === 'completed' || executionProgress?.status === 'failed') {
      setIsThinkingExpanded(false)
    }
  }, [executionProgress?.status])

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

  const isRunning = executionProgress.status === 'running'
  const isCompleted = executionProgress.status === 'completed' || executionProgress.status === 'failed'
  const isSuccess = executionProgress.status === 'completed'
  const isFailed = executionProgress.status === 'failed'

  const handleStop = () => {
    // Abort execution and show partial results
    abortExecution()
  }

  const handleRunAgain = () => {
    if (activeRecording) {
      executeRecording(activeRecording.id)
    }
  }

  const handleDone = () => {
    setMode('idle')
  }

  return (
    <div className="flex flex-col h-full bg-background-alt">
      {/* Status Bar */}
      <div className={cn(
        "flex items-center justify-between px-4 py-3 border-b border-border",
        isRunning ? "bg-accent" :
        isSuccess ? "bg-green-500/10" :
        "bg-yellow-500/10"
      )}>
        <div className="flex items-center gap-2">
          {isRunning ? (
            <>
              <Loader2 className="w-4 h-4 text-[hsl(var(--brand))] animate-spin" />
              <span className="text-sm font-medium text-foreground">
                Running: {activeRecording.name}
              </span>
            </>
          ) : isSuccess ? (
            <>
              <CheckCircle className="w-4 h-4 text-green-500" />
              <span className="text-sm font-medium text-foreground">
                Completed: {activeRecording.name}
              </span>
            </>
          ) : (
            <>
              <AlertCircle className="w-4 h-4 text-yellow-500" />
              <span className="text-sm font-medium text-foreground">
                Stopped: {activeRecording.name}
              </span>
            </>
          )}
        </div>
        {isRunning && (
          <Button
            onClick={handleStop}
            variant="outline"
            size="sm"
            className="gap-1 border-destructive text-destructive hover:bg-destructive hover:text-white transition-colors"
          >
            <Square className="w-3 h-3 fill-current" />
            Stop
          </Button>
        )}
        {isCompleted && executionSummary && (
          <span className="text-xs text-muted-foreground">
            {formatDuration(executionSummary.duration)}
          </span>
        )}
      </div>

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* Thinking section - Collapsible when completed */}
        {thinkingMessages.length > 0 && (
          <>
            {isCompleted && (
              <button
                onClick={() => setIsThinkingExpanded(!isThinkingExpanded)}
                className="flex items-center justify-between px-4 py-2 bg-background hover:bg-accent transition-colors border-b border-border"
              >
                <span className="text-sm font-medium text-foreground">
                  Agent Thinking
                </span>
                {isThinkingExpanded ? (
                  <ChevronUp className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                )}
              </button>
            )}

            {(isRunning || isThinkingExpanded) && (
              <div className={cn(
                "overflow-y-auto px-4 py-4",
                isRunning ? "flex-1" : "max-h-96"
              )}>
                <GroupedThinkingSection
                  messages={thinkingMessages}
                  isLatest={true}
                  isTaskCompleted={isCompleted}
                />
              </div>
            )}
          </>
        )}

        {/* Empty state when no thinking messages and running */}
        {thinkingMessages.length === 0 && isRunning && (
          <div className="flex-1 flex items-center justify-center px-4">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[hsl(var(--brand))]/10 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-[hsl(var(--brand))] animate-spin" />
              </div>
              <p className="text-sm text-muted-foreground">
                Executing your workflow...
              </p>
            </div>
          </div>
        )}

        {/* Summary section when completed */}
        {isCompleted && executionSummary && (
          <div className="flex-1 flex flex-col justify-between px-4 py-4">
            {/* Status display */}
            <div className="flex flex-col items-center justify-center py-8">
              <div className={cn(
                "w-16 h-16 rounded-full flex items-center justify-center mb-4",
                isSuccess ? "bg-green-500/10" : "bg-yellow-500/10"
              )}>
                {isSuccess ? (
                  <CheckCircle className="w-8 h-8 text-green-500" />
                ) : (
                  <AlertCircle className="w-8 h-8 text-yellow-500" />
                )}
              </div>
              <span className={cn(
                "text-lg font-medium mb-4",
                isSuccess ? "text-green-500" : "text-yellow-500"
              )}>
                {isSuccess ? 'Success' : 'Workflow Stopped'}
              </span>

              {/* Error message if failed */}
              {isFailed && executionSummary.errorMessage && (
                <div className="bg-destructive/10 rounded-lg p-3 max-w-md">
                  <p className="text-sm text-destructive">
                    {executionSummary.errorMessage}
                  </p>
                </div>
              )}

              {/* Success results if any */}
              {isSuccess && executionSummary.results && executionSummary.results.length > 0 && (
                <div className="bg-green-500/10 rounded-lg p-3 max-w-md">
                  <ul className="space-y-1">
                    {executionSummary.results.map((result, index) => (
                      <li key={index} className="text-sm text-green-700 dark:text-green-400 flex items-start gap-2">
                        <span className="text-green-600 dark:text-green-500 mt-0.5">—</span>
                        <span>{result}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="space-y-2 max-w-md mx-auto w-full">
              <Button
                onClick={handleRunAgain}
                variant="outline"
                className="w-full gap-2 border-[hsl(var(--brand))] text-[hsl(var(--brand))] hover:bg-[hsl(var(--brand))] hover:text-white transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Run Again
              </Button>
              <Button
                onClick={handleDone}
                variant="ghost"
                className="w-full gap-2 hover:bg-accent transition-colors"
              >
                <Home className="w-4 h-4" />
                Done
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}