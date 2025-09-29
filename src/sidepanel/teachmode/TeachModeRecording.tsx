import React, { useState, useEffect } from 'react'
import { Square, Circle, ArrowLeft, Play, Mic, MicOff } from 'lucide-react'
import { Button } from '@/sidepanel/components/ui/button'
import { StepCard } from './components/StepCard'
import { VoiceIndicator } from './components/VoiceIndicator'
import { TranscriptDisplay } from './components/TranscriptDisplay'
import { useTeachModeStore } from './teachmode.store'
import { useOpenAITranscription } from './hooks/useOpenAITranscription'
import { formatDuration } from './teachmode.utils'
import type { CapturedEvent } from './teachmode.types'
import { cn } from '@/sidepanel/lib/utils'

export function TeachModeRecording() {
  const {
    recordingEvents,
    stopRecording,
    addEvent,
    recordingStartTime,
    startRecording,
    cancelRecording,
    isRecordingActive,
    transcripts,
    voiceStatus,
    clearTranscripts
  } = useTeachModeStore()

  const [recordingTime, setRecordingTime] = useState(0)

  // Initialize OpenAI transcription for voice recording
  const { error: transcriptionError, isSpeaking } = useOpenAITranscription({
    enabled: isRecordingActive
  })

  useEffect(() => {
    if (!isRecordingActive || !recordingStartTime) {
      setRecordingTime(0)
      return
    }

    const updateElapsed = () => {
      const elapsed = Math.floor((Date.now() - recordingStartTime) / 1000)
      setRecordingTime(elapsed)
    }

    updateElapsed()
    const timer = window.setInterval(updateElapsed, 1000)

    return () => window.clearInterval(timer)
  }, [isRecordingActive, recordingStartTime])

  // Show transcription error if any
  useEffect(() => {
    if (transcriptionError) {
      console.error('Transcription error:', transcriptionError)
    }
  }, [transcriptionError])

  const handleBack = () => {
    cancelRecording()
  }

  const handleStartRecording = async () => {
    if (isRecordingActive) return

    clearTranscripts()  // Clear any previous transcripts
    setRecordingTime(0)

    try {
      await startRecording()
    } catch (error) {
      console.error('Failed to start recording:', error)
    }
  }

  const handleStopRecording = async () => {
    if (!isRecordingActive) return

    try {
      await stopRecording()
    } catch (error) {
      console.error('Failed to stop recording:', error)
    }
  }

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      {/* Compact Header */}
      <header className={cn(
        'px-4 py-3 border-b relative transition-all duration-200',
        isRecordingActive
          ? 'border-destructive/40 bg-destructive/5'
          : 'border-border'
      )}>
        {isRecordingActive && (
          <div className="absolute inset-0 border-2 border-destructive/20 pointer-events-none recording-border-glow" />
        )}

        <div className="flex items-center justify-between gap-3 relative z-10">
          <button
            onClick={handleBack}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors p-1"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Cancel</span>
          </button>

          <div className="flex items-center gap-3">
            {isRecordingActive && (
              <>
                <Circle className="w-3 h-3 text-destructive fill-destructive recording-pulse" />
                <span className="text-sm font-medium text-foreground">Recording</span>
                <span className="text-sm font-mono text-destructive">
                  {formatDuration(recordingTime)}
                </span>
              </>
            )}
            {!isRecordingActive && (
              <span className="text-sm text-muted-foreground">Ready to record</span>
            )}
          </div>

          {isRecordingActive ? (
            <Button
              onClick={handleStopRecording}
              variant="destructive"
              size="sm"
              className="gap-1"
            >
              <Square className="w-3 h-3 fill-current" />
              Stop
            </Button>
          ) : (
            <Button
              onClick={handleStartRecording}
              size="sm"
              className="gap-2"
            >
              <Play className="w-4 h-4" />
              Start Recording
            </Button>
          )}
        </div>
      </header>

      {/* Status Bar - Only when recording */}
      {isRecordingActive && (
        <div className="px-4 py-2 bg-destructive/10 border-b border-destructive/30">
          <p className="text-xs text-foreground font-medium">
            Your workflow is being captured
          </p>
        </div>
      )}

      {/* Main Content Area - Using flex for proper layout */}
      {!isRecordingActive ? (
        // Ready State - Integrated into same screen
        <div className="flex-1 overflow-y-auto px-6 py-8">
          <div className="max-w-2xl mx-auto space-y-8">
            {/* Main Message */}
            <div className="text-center space-y-3 mb-12">
              <h2 className="text-2xl font-semibold text-foreground">
                Ready to show BrowserOS a workflow
              </h2>
              <p className="text-base text-muted-foreground">
                Press start when you're ready. We'll capture every action
                <br />and your narration in real time.
              </p>
            </div>

            {/* Tips Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/30 border border-border/50">
                <Mic className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">Narrate intent</p>
                  <p className="text-xs text-muted-foreground">
                    Speak as you go so the agent learns context
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/30 border border-border/50">
                <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center mt-0.5 flex-shrink-0">
                  <span className="text-xs font-medium text-primary">✓</span>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">Move naturally</p>
                  <p className="text-xs text-muted-foreground">
                    Pauses and rethinks are totally fine
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/30 border border-border/50">
                <Square className="w-5 h-5 text-destructive mt-0.5 flex-shrink-0" />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">Stop anytime</p>
                  <p className="text-xs text-muted-foreground">
                    We'll process everything you captured
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        // Recording State - Fixed layout with scrollable events
        <>
          <div className="flex-1 flex flex-col min-h-0">
            {/* Events List Container - Scrollable */}
            <div className="flex-1 overflow-y-auto px-4 py-4">
              {/* Events Grid */}
              {recordingEvents.length > 0 ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 auto-rows-max">
                  {recordingEvents.map((event, index) => (
                    <StepCard
                      key={event.id}
                      step={event}
                      isActive={false}
                      showConnector={false}
                    />
                  ))}
                </div>
              ) : (
                // Waiting Message
                <div className="text-center py-12">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
                    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  </div>
                  <p className="text-sm font-medium text-foreground mb-1">
                    Waiting for your first action...
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Click, type, or navigate to start recording your workflow
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Voice Transcript - Fixed at bottom */}
          <div className="border-t bg-background">
            <TranscriptDisplay
              transcripts={transcripts}
              status={voiceStatus}
              isRecordingActive={isRecordingActive}
            />
          </div>
        </>
      )}
    </div>
  )
}
