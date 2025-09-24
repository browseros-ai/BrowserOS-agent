import React, { useState, useEffect } from 'react'
import { Square, Circle } from 'lucide-react'
import { Button } from '@/sidepanel/components/ui/button'
import { StepCard } from './components/StepCard'
import { VoiceIndicator } from './components/VoiceIndicator'
import { useTeachModeStore } from './teachmode.store'
import { formatDuration } from './teachmode.utils'
import type { CapturedEvent } from './teachmode.types'

export function TeachModeRecording() {
  const { currentIntent, recordingEvents, stopRecording, addEvent, recordingStartTime } = useTeachModeStore()
  const [recordingTime, setRecordingTime] = useState(0)
  const [isListening, setIsListening] = useState(false)

  useEffect(() => {
    // Update recording timer
    const timer = setInterval(() => {
      if (recordingStartTime) {
        const elapsed = Math.floor((Date.now() - recordingStartTime) / 1000)
        setRecordingTime(elapsed)
      }
    }, 1000)

    return () => clearInterval(timer)
  }, [recordingStartTime])

  useEffect(() => {
    // Simulate receiving events during recording (in real app, these would come from Chrome extension)
    const simulateEvents = () => {
      // Simulate first event after 2 seconds
      setTimeout(() => {
        addEvent({
          id: `event_${Date.now()}_1`,
          timestamp: Date.now(),
          stepNumber: 1,
          action: {
            type: 'navigate',
            description: 'Navigate to Gmail',
            url: 'gmail.com'
          },
          voiceAnnotation: 'Open my email inbox',
          screenshot: 'data:image/png;base64,dummy'
        })
      }, 2000)

      // Simulate second event after 5 seconds
      setTimeout(() => {
        addEvent({
          id: `event_${Date.now()}_2`,
          timestamp: Date.now(),
          stepNumber: 2,
          action: {
            type: 'click',
            description: 'Clicked "Promotions"',
            element: 'Tab selector'
          },
          voiceAnnotation: 'Go to promotional emails',
          screenshot: 'data:image/png;base64,dummy'
        })
      }, 5000)
    }

    simulateEvents()

    // Simulate voice listening periodically
    const voiceInterval = setInterval(() => {
      setIsListening(true)
      setTimeout(() => setIsListening(false), 2000)
    }, 5000)

    return () => clearInterval(voiceInterval)
  }, [addEvent])

  const handleStop = () => {
    stopRecording()
  }

  // Current recording step (placeholder for new event being captured)
  const currentStep: CapturedEvent = {
    id: 'current',
    timestamp: Date.now(),
    stepNumber: recordingEvents.length + 1,
    action: {
      type: 'click',
      description: '[Current action]',
      element: '...'
    }
  }

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Recording Header with red border glow */}
      <div className="px-4 py-3 border-b border-destructive/50 bg-destructive/5 relative">
        {/* Red border glow effect */}
        <div className="absolute inset-0 border-2 border-destructive/20 pointer-events-none recording-border-glow" />

        <div className="flex items-center justify-between relative">
          <div className="flex items-center gap-2">
            <Circle className="w-4 h-4 text-destructive fill-destructive recording-pulse" />
            <span className="text-sm font-medium text-foreground">Recording</span>
            <span className="text-sm font-mono text-destructive">
              {formatDuration(recordingTime)}
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
      </div>

      {/* Intent Reminder */}
      <div className="px-4 py-2 bg-muted/50 border-b border-border">
        <p className="text-xs text-muted-foreground">
          Automating: <span className="text-foreground">{currentIntent}</span>
        </p>
      </div>

      {/* Timeline */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="space-y-3">
          {/* Recorded steps */}
          {recordingEvents.map((event, index) => (
            <StepCard
              key={event.id}
              step={event}
              showConnector={index < recordingEvents.length || true}
            />
          ))}

          {/* Current recording step */}
          <StepCard
            step={currentStep}
            isActive={true}
            showConnector={false}
          />

          {/* Voice indicator */}
          {isListening && (
            <div className="mt-2">
              <VoiceIndicator isListening={isListening} isEnabled={true} />
            </div>
          )}
        </div>

        {/* Tip */}
        <div className="mt-6 p-3 bg-muted/50 rounded-lg">
          <p className="text-xs text-muted-foreground">
            💡 Tip: Describe what you're doing as you click for better learning
          </p>
        </div>
      </div>
    </div>
  )
}