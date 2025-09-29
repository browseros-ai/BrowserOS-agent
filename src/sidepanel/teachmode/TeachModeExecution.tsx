import React, { useMemo } from 'react'
import { Square, Loader2 } from 'lucide-react'
import { Button } from '@/sidepanel/components/ui/button'
import { useTeachModeStore } from './teachmode.store'
import { GroupedThinkingSection } from '@/sidepanel/components/GroupedThinkingSection'

export function TeachModeExecution() {
  const { activeRecording, executionProgress, abortExecution, executionMessages } = useTeachModeStore(state => ({
    activeRecording: state.activeRecording,
    executionProgress: state.executionProgress,
    abortExecution: state.abortExecution,
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
    // Abort execution and show partial results
    abortExecution()
  }

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Status Bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 bg-accent/50">
        <div className="flex items-center gap-2">
          <Loader2 className="w-4 h-4 text-[hsl(var(--brand))] animate-spin" />
          <span className="text-sm font-medium text-foreground">
            Running: {activeRecording.name}
          </span>
        </div>
        <Button
          onClick={handleStop}
          variant="outline"
          size="sm"
          className="gap-1 border-destructive text-destructive hover:bg-destructive hover:text-white transition-colors"
        >
          <Square className="w-3 h-3 fill-current" />
          Stop
        </Button>
      </div>

      {/* Thinking section - Made scrollable */}
      {thinkingMessages.length > 0 && (
        <div className="flex-1 overflow-y-auto px-4 py-4">
          <GroupedThinkingSection
            messages={thinkingMessages}
            isLatest={true}
            isTaskCompleted={executionProgress.status === 'completed' || executionProgress.status === 'failed'}
          />
        </div>
      )}

      {/* Empty state when no thinking messages */}
      {thinkingMessages.length === 0 && (
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
    </div>
  )
}