import React, { useState, useEffect } from 'react'
import { Button } from '@/sidepanel/components/ui/button'
import { Circle, Square } from 'lucide-react'

/**
 * TeachModeButton - Simple button to start/stop teach mode recording
 */
export const TeachModeButton: React.FC = () => {
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [timerId, setTimerId] = useState<NodeJS.Timeout | null>(null)

  // Handle recording timer
  useEffect(() => {
    if (isRecording) {
      const id = setInterval(() => {
        setRecordingTime(prev => prev + 1)
      }, 1000)
      setTimerId(id)
    } else {
      if (timerId) {
        clearInterval(timerId)
        setTimerId(null)
      }
      setRecordingTime(0)
    }

    return () => {
      if (timerId) {
        clearInterval(timerId)
      }
    }
  }, [isRecording])

  const handleClick = async () => {
    if (isRecording) {
      // Stop recording
      chrome.runtime.sendMessage({
        action: 'TEACH_MODE_STOP'
      }, (response) => {
        if (response?.success) {
          console.log('[TeachMode] Recording stopped:', response.message)
          setIsRecording(false)
        } else {
          console.error('[TeachMode] Failed to stop recording:', response?.error)
        }
      })
    } else {
      // Start recording
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true })

      chrome.runtime.sendMessage({
        action: 'TEACH_MODE_START',
        tabId: activeTab?.id
      }, (response) => {
        if (response?.success) {
          console.log('[TeachMode] Recording started on tab:', response.tabId)
          setIsRecording(true)
        } else {
          console.error('[TeachMode] Failed to start recording:', response?.error)
        }
      })
    }
  }

  // Format recording time as MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <Button
      onClick={handleClick}
      variant={isRecording ? 'destructive' : 'ghost'}
      size="sm"
      className={`
        h-9 px-2 sm:px-3 rounded-xl smooth-hover smooth-transform
        ${isRecording
          ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse'
          : 'hover:bg-purple-100 dark:hover:bg-purple-900/20 hover:text-purple-600 dark:hover:text-purple-400 hover:scale-105'
        }
        flex items-center gap-1.5
      `}
      aria-label={isRecording ? 'Stop teaching' : 'Start teaching'}
      title={isRecording ? 'Stop teaching mode' : 'Start teaching mode'}
    >
      {isRecording ? (
        <>
          <Square className="w-3 h-3 fill-current" />
          <span className="text-xs font-medium">{formatTime(recordingTime)}</span>
        </>
      ) : (
        <>
          <Circle className="w-4 h-4" />
          <span className="hidden sm:inline text-xs font-medium">Teach</span>
        </>
      )}
    </Button>
  )
}