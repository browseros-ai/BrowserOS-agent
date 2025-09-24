import React, { useState, useEffect } from 'react'
import { VoiceRecordingService } from '@/lib/services/VoiceRecordingService'

interface RecordingControlsProps {
  isRecording: boolean
  recordingTabId?: number
  voiceEnabled?: boolean
  onStart: (options?: { captureVoice?: boolean }) => void
  onStop: () => void
  onVoiceToggle?: (enabled: boolean) => void
}

/**
 * Recording controls with start/stop button and status display
 */
export function RecordingControls({
  isRecording,
  recordingTabId,
  voiceEnabled = false,
  onStart,
  onStop,
  onVoiceToggle
}: RecordingControlsProps) {
  const [duration, setDuration] = useState(0)
  const [startTime, setStartTime] = useState<number | null>(null)
  const [localVoiceEnabled, setLocalVoiceEnabled] = useState(voiceEnabled)
  const [micPermissionStatus, setMicPermissionStatus] = useState<'unknown' | 'granted' | 'denied'>('unknown')

  // Track recording duration
  useEffect(() => {
    if (isRecording && !startTime) {
      setStartTime(Date.now())
      setDuration(0)
    } else if (!isRecording && startTime) {
      setStartTime(null)
      setDuration(0)
    }
  }, [isRecording])

  // Update duration every second while recording
  useEffect(() => {
    if (!isRecording || !startTime) return

    const interval = setInterval(() => {
      setDuration(Math.floor((Date.now() - startTime) / 1000))
    }, 1000)

    return () => clearInterval(interval)
  }, [isRecording, startTime])

  // Handle voice toggle
  const handleVoiceToggle = () => {
    const newValue = !localVoiceEnabled
    setLocalVoiceEnabled(newValue)
    onVoiceToggle?.(newValue)
  }

  // Handle start recording with voice option
  const handleStart = () => {
    onStart({ captureVoice: localVoiceEnabled })
  }

  // Check microphone permissions
  const checkMicPermissions = async () => {
    try {
      const voiceService = VoiceRecordingService.getInstance()
      const hasPermission = await voiceService.checkMicrophonePermission()
      setMicPermissionStatus(hasPermission ? 'granted' : 'denied')
    } catch (error) {
      console.error('Failed to check microphone permissions:', error)
      setMicPermissionStatus('denied')
    }
  }

  // Check permissions when voice is enabled
  useEffect(() => {
    if (localVoiceEnabled && !isRecording) {
      checkMicPermissions()
    }
  }, [localVoiceEnabled, isRecording])

  // Manual permission test
  const testPermissions = async () => {
    try {
      const voiceService = VoiceRecordingService.getInstance()
      await voiceService.debugPermissions()

      // Try to request permission manually
      await voiceService.requestMicrophonePermission()
      setMicPermissionStatus('granted')
      console.log('✅ Permission test successful!')
    } catch (error) {
      console.error('❌ Permission test failed:', error)
      setMicPermissionStatus('denied')
    }
  }

  // Format duration as mm:ss
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="p-4">
      {/* Status Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {isRecording ? (
            <>
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
              </span>
              <span className="text-sm font-medium text-red-500">Recording</span>
            </>
          ) : (
            <>
              <span className="h-3 w-3 rounded-full bg-gray-400"></span>
              <span className="text-sm text-muted-foreground">Not Recording</span>
            </>
          )}
        </div>

        {isRecording && (
          <div className="text-sm font-mono text-muted-foreground">
            {formatDuration(duration)}
          </div>
        )}
      </div>

      {/* Voice Recording Toggle */}
      {!isRecording && (
        <div className="mb-4 flex items-center justify-between px-3 py-2 rounded-md bg-muted/30">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-muted-foreground" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
            </svg>
            <div>
              <div className="text-sm font-medium flex items-center gap-2">
                Voice Narration
                {localVoiceEnabled && micPermissionStatus === 'granted' && (
                  <span className="text-xs text-green-600">✓</span>
                )}
                {localVoiceEnabled && micPermissionStatus === 'denied' && (
                  <span className="text-xs text-red-500">✗ Permission needed</span>
                )}
              </div>
              <div className="text-xs text-muted-foreground">
                Capture voice explanation during recording
                {localVoiceEnabled && micPermissionStatus === 'denied' && (
                  <div className="text-red-500 mt-1">
                    Click Start Recording to grant microphone access
                    <button
                      onClick={testPermissions}
                      className="ml-2 px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
                    >
                      Test Permissions
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={handleVoiceToggle}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              localVoiceEnabled ? 'bg-green-600' : 'bg-gray-200'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                localVoiceEnabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      )}

      {/* Recording Info */}
      {isRecording && recordingTabId && (
        <div className="mb-3 px-3 py-2 rounded-md bg-muted/50">
          <div className="text-xs text-muted-foreground">
            Recording Tab ID: {recordingTabId}
            {voiceEnabled && (
              <span className="ml-2 text-green-600">• Voice Active</span>
            )}
          </div>
        </div>
      )}

      {/* Main Control Button */}
      <button
        onClick={isRecording ? onStop : handleStart}
        className={`
          w-full py-3 px-4 rounded-lg font-medium text-sm
          transition-all duration-200 transform active:scale-[0.98]
          ${isRecording
            ? 'bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/20'
            : 'bg-green-500 hover:bg-green-600 text-white shadow-lg shadow-green-500/20'
          }
        `}
      >
        {isRecording ? (
          <div className="flex items-center justify-center gap-2">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <rect x="6" y="6" width="8" height="8" rx="1" />
            </svg>
            Stop Recording
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <circle cx="10" cy="10" r="7" />
            </svg>
            Start Recording
          </div>
        )}
      </button>

      {/* Instructions */}
      {!isRecording && (
        <div className="mt-3 text-xs text-muted-foreground text-center">
          Click to start recording your interactions on the current tab
          {localVoiceEnabled && (
            <div className="mt-1 text-green-600">Voice narration will be captured via microphone</div>
          )}
        </div>
      )}
      {isRecording && (
        <div className="mt-3 text-xs text-muted-foreground text-center">
          Recording all clicks, inputs, and navigation.
          {voiceEnabled && (
            <div className="text-green-600">🎤 Voice recording active</div>
          )}
          Stop when done.
        </div>
      )}
    </div>
  )
}