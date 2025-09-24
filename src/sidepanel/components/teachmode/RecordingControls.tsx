import React, { useState, useEffect } from 'react'

interface RecordingControlsProps {
  isRecording: boolean
  recordingTabId?: number
  onStart: () => void
  onStop: () => void
}

/**
 * Recording controls with start/stop button and status display
 */
export function RecordingControls({
  isRecording,
  recordingTabId,
  onStart,
  onStop
}: RecordingControlsProps) {
  const [duration, setDuration] = useState(0)
  const [startTime, setStartTime] = useState<number | null>(null)

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

      {/* Recording Info */}
      {isRecording && recordingTabId && (
        <div className="mb-3 px-3 py-2 rounded-md bg-muted/50">
          <div className="text-xs text-muted-foreground">
            Recording Tab ID: {recordingTabId}
          </div>
        </div>
      )}

      {/* Main Control Button */}
      <button
        onClick={isRecording ? onStop : onStart}
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
        </div>
      )}
      {isRecording && (
        <div className="mt-3 text-xs text-muted-foreground text-center">
          Recording all clicks, inputs, and navigation. Stop when done.
        </div>
      )}
    </div>
  )
}