import React, { useState, useEffect } from 'react'
import { Square, Circle, ArrowLeft, Play } from 'lucide-react'
import { Button } from '@/sidepanel/components/ui/button'
import { StepCard } from './components/StepCard'
import { VoiceIndicator } from './components/VoiceIndicator'
import { useTeachModeStore } from './teachmode.store'
import { formatDuration } from './teachmode.utils'
import type { CapturedEvent } from './teachmode.types'

export function TeachModeRecording() {
  const { recordingEvents, stopRecording, addEvent, recordingStartTime, setMode, startRecording } = useTeachModeStore()
  const [recordingTime, setRecordingTime] = useState(0)
  const [isListening, setIsListening] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [workflowName, setWorkflowName] = useState('')

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

  const handleBack = () => {
    setMode('idle')
  }

  const handleStartRecording = () => {
    if (workflowName.trim()) {
      setIsRecording(true)
      startRecording()
      // Send message to Chrome extension to start recording
      chrome.runtime.sendMessage({
        action: 'TEACH_MODE_START',
        name: workflowName.trim()
      })
    }
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

  if (!isRecording) {
    // Show start recording screen
    return (
      <div className="flex flex-col h-full bg-background">
        {/* Internal navigation */}
        <div className="flex items-center px-4 py-2 border-b border-border">
          <button
            onClick={handleBack}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors p-1"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Cancel</span>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col items-center justify-center px-4">
          <div className="w-full max-w-md space-y-6">
            {/* Title */}
            <div className="text-center">
              <h2 className="text-lg font-semibold text-foreground mb-2">
                What would you like to automate?
              </h2>
              <p className="text-sm text-muted-foreground">
                Give your workflow a name and start recording
              </p>
            </div>

            {/* Input */}
            <input
              type="text"
              placeholder="e.g., Check daily emails"
              value={workflowName}
              onChange={(e) => setWorkflowName(e.target.value)}
              className="w-full px-4 py-3 bg-background-alt border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary text-foreground"
              autoFocus
            />

            {/* Start button */}
            <Button
              onClick={handleStartRecording}
              size="lg"
              className="w-full gap-2"
              disabled={!workflowName.trim()}
            >
              <Play className="w-4 h-4" />
              Start Recording
            </Button>

            {/* Tips */}
            <div className="text-xs text-muted-foreground space-y-1">
              <p>• Describe each action as you perform it</p>
              <p>• Take your time - the AI will learn your patterns</p>
              <p>• You can edit the workflow after recording</p>
            </div>
          </div>
        </div>
      </div>
    )
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

      {/* Workflow name */}
      <div className="px-4 py-2 bg-muted/50 border-b border-border">
        <p className="text-xs text-muted-foreground">
          Recording: <span className="text-foreground font-medium">{workflowName}</span>
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