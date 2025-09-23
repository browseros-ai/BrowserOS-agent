import React, { useState, useEffect, useRef } from 'react'
import { RecordingControls } from './RecordingControls'
import { DebugStream } from './DebugStream'
import { RecordingsList } from './RecordingsList'
import { TeachModeStorageClient } from '@/lib/teach-mode/storage/TeachModeStorageClient'

interface StorageMetadata {
  id: string
  title: string
  description?: string
  url: string
  tabId: number
  startTime: number
  endTime: number
  eventCount: number
  sizeBytes: number
  createdAt: number
}

interface TeachModeViewProps {
  onBack?: () => void
}

/**
 * Main view for Teach Mode functionality
 * Self-contained component for recording, debugging, and managing recordings
 */
export function TeachModeView({ onBack }: TeachModeViewProps = {}) {
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTabId, setRecordingTabId] = useState<number | undefined>()
  const [recordings, setRecordings] = useState<StorageMetadata[]>([])
  const [debugMessages, setDebugMessages] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const seenMessageIds = useRef<Set<string>>(new Set())

  // Load recordings on mount
  useEffect(() => {
    loadRecordings()
    checkRecordingStatus()
  }, [])

  // Load all recordings from storage
  const loadRecordings = async () => {
    try {
      setIsLoading(true)
      const recs = await TeachModeStorageClient.listRecordings()
      setRecordings(recs)
    } catch (err) {
      console.error('Failed to load recordings:', err)
      setError('Failed to load recordings')
    } finally {
      setIsLoading(false)
    }
  }

  // Check current recording status
  const checkRecordingStatus = async () => {
    try {
      const response = await new Promise<any>((resolve) => {
        chrome.runtime.sendMessage(
          { action: 'TEACH_MODE_STATUS' },
          resolve
        )
      })

      if (response?.success) {
        setIsRecording(response.isRecording || false)
        setRecordingTabId(response.tabId)
      }
    } catch (err) {
      console.error('Failed to check recording status:', err)
    }
  }

  // Handle start recording
  const handleStartRecording = async () => {
    try {
      setError(null)

      // Get current tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      if (!tab.id) {
        setError('No active tab found')
        return
      }

      // Send start message
      const response = await new Promise<any>((resolve) => {
        chrome.runtime.sendMessage(
          { action: 'TEACH_MODE_START', tabId: tab.id },
          resolve
        )
      })

      if (response?.success) {
        setIsRecording(true)
        setRecordingTabId(tab.id)
        setDebugMessages([]) // Clear debug messages for new recording
        seenMessageIds.current.clear() // Clear seen message IDs
      } else {
        setError(response?.error || 'Failed to start recording')
      }
    } catch (err) {
      console.error('Failed to start recording:', err)
      setError('Failed to start recording')
    }
  }

  // Handle stop recording
  const handleStopRecording = async () => {
    try {
      setError(null)

      const response = await new Promise<any>((resolve) => {
        chrome.runtime.sendMessage(
          { action: 'TEACH_MODE_STOP' },
          resolve
        )
      })

      if (response?.success) {
        setIsRecording(false)
        setRecordingTabId(undefined)
        seenMessageIds.current.clear() // Clear seen message IDs

        // Reload recordings to show the new one
        await loadRecordings()
      } else {
        setError(response?.error || 'Failed to stop recording')
      }
    } catch (err) {
      console.error('Failed to stop recording:', err)
      setError('Failed to stop recording')
    }
  }

  // Handle delete recording
  const handleDeleteRecording = async (recordingId: string) => {
    try {
      const success = await TeachModeStorageClient.deleteRecording(recordingId)
      if (success) {
        await loadRecordings()
      }
    } catch (err) {
      console.error('Failed to delete recording:', err)
      setError('Failed to delete recording')
    }
  }

  // Handle export recording
  const handleExportRecording = async (recordingId: string) => {
    try {
      await TeachModeStorageClient.exportRecording(recordingId)
    } catch (err) {
      console.error('Failed to export recording:', err)
      setError('Failed to export recording')
    }
  }

  // Add debug message with deduplication
  const addDebugMessage = (message: string, messageId?: string) => {
    // Use messageId if provided, otherwise create one based on content and time
    const id = messageId || `${message}_${Date.now()}`

    // Check if we've already seen this message
    if (seenMessageIds.current.has(id)) {
      return
    }

    seenMessageIds.current.add(id)

    setDebugMessages(prev => {
      // Keep only last 50 messages
      const updated = [...prev, message]
      if (updated.length > 50) {
        return updated.slice(-50)
      }
      return updated
    })
  }

  // Clear debug messages
  const clearDebugMessages = () => {
    setDebugMessages([])
    seenMessageIds.current.clear()
  }

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      {/* Header with back button */}
      <div className="flex items-center justify-between h-12 px-3 bg-[hsl(var(--header))] border-b border-border/50">
        <div className="flex items-center gap-2">
          {onBack && (
            <button
              onClick={onBack}
              className="p-2 hover:bg-muted rounded-lg transition-colors"
              aria-label="Back to chat"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
          )}
          <h1 className="text-sm font-medium">Teach Mode</h1>
        </div>
        <div className="text-xs text-muted-foreground">
          Record browser interactions
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="px-4 py-2 bg-red-500/10 text-red-500 text-sm">
          {error}
          <button
            onClick={() => setError(null)}
            className="ml-2 text-red-300 hover:text-red-200"
          >
            ✕
          </button>
        </div>
      )}

      {/* Recording Controls */}
      <div className="flex-shrink-0 border-b border-border">
        <RecordingControls
          isRecording={isRecording}
          recordingTabId={recordingTabId}
          onStart={handleStartRecording}
          onStop={handleStopRecording}
        />
      </div>

      {/* Debug Stream */}
      <div className="flex-shrink-0 h-48 border-b border-border">
        <DebugStream
          messages={debugMessages}
          isRecording={isRecording}
          onNewMessage={addDebugMessage}
          onClear={clearDebugMessages}
        />
      </div>

      {/* Recordings List */}
      <div className="flex-grow overflow-hidden">
        <RecordingsList
          recordings={recordings}
          isLoading={isLoading}
          onDelete={handleDeleteRecording}
          onExport={handleExportRecording}
          onRefresh={loadRecordings}
        />
      </div>
    </div>
  )
}