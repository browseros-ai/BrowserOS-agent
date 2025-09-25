import React, { useState, useEffect } from 'react'
import { Square, Circle, ArrowLeft, Play } from 'lucide-react'
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
    vapiStatus,
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
      // Optionally show error to user
    }
  }

  const handleStopRecording = async () => {
    if (!isRecordingActive) return

    try {
      await stopRecording()
    } catch (error) {
      console.error('Failed to stop recording:', error)
      // Optionally show error to user
    }
  }


  const statusLabel = isRecordingActive ? 'Recording' : 'Ready to record'
  const statusDescription = isRecordingActive
    ? 'Your workflow is being captured'
    : 'Press start to begin capturing your workflow.'

  return (
    <div className="flex flex-col h-full bg-background">
      <header
        className={cn(
          'px-4 py-3 border-b relative',
          isRecordingActive ? 'border-destructive/40 bg-destructive/5' : 'border-border bg-muted/10'
        )}
      >
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

          <div className="flex items-center gap-2">
            <Circle
              className={cn(
                'w-4 h-4',
                isRecordingActive ? 'text-destructive fill-destructive recording-pulse' : 'text-muted-foreground'
              )}
            />
            <span className="text-sm font-medium text-foreground">{statusLabel}</span>
            <span
              className={cn(
                'text-sm font-mono',
                isRecordingActive ? 'text-destructive' : 'text-muted-foreground'
              )}
            >
              {formatDuration(recordingTime)}
            </span>
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

      <div
        className={cn(
          'px-4 py-2 border-b',
          isRecordingActive ? 'bg-destructive/10 border-destructive/30' : 'bg-muted/40 border-border'
        )}
      >
        <p className="text-xs text-muted-foreground">
          {isRecordingActive ? (
            <>
              Recording: <span className="text-foreground font-medium">{statusDescription}</span>
            </>
          ) : (
            <>
              Standby: <span className="text-foreground font-medium">{statusDescription}</span>
            </>
          )}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {isRecordingActive ? (
          <>
            <div className="space-y-3">
              {recordingEvents.map((event, index) => (
                <StepCard
                  key={event.id}
                  step={event}
                  showConnector={index < recordingEvents.length - 1}
                />
              ))}

              {recordingEvents.length === 0 && (
                <div className="text-center py-8">
                  <div className="text-sm text-muted-foreground mb-2">
                    Waiting for your first action...
                  </div>
                </div>
              )}

              {isSpeaking && (
                <div className="mt-2">
                  <VoiceIndicator isListening={isSpeaking} isEnabled={true} />
                </div>
              )}
            </div>

            {/* Voice Transcript Display */}
            <TranscriptDisplay
              transcripts={transcripts}
              vapiStatus={vapiStatus}
              isRecordingActive={isRecordingActive}
            />

            <div className="mt-6 p-3 bg-muted/50 rounded-lg">
              <p className="text-xs text-muted-foreground">
                💡 Tip: Narrate what you’re doing as you click for smarter automation
              </p>
            </div>
          </>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-5 max-w-sm mx-auto">
            <div>
              <h2 className="text-base font-semibold text-foreground mb-2">
                Ready to show BrowserOS a workflow
              </h2>
              <p className="text-sm text-muted-foreground">
                Press start when you’re ready. We’ll capture every action and your narration in real time.
              </p>
            </div>

            <Button
              onClick={handleStartRecording}
              size="lg"
              className="gap-2"
            >
              <Play className="w-4 h-4" />
              Start Recording
            </Button>

            <div className="text-xs text-muted-foreground space-y-1">
              <p>• Narrate intent as you go so the agent learns context</p>
              <p>• Move naturally—pauses and rethinks are totally fine</p>
              <p>• Stop anytime; we’ll process everything you captured</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
