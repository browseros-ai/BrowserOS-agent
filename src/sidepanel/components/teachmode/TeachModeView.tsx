import React, { useState, useEffect, useRef } from 'react'
import { RecordingControls } from './RecordingControls'
import { DebugStream } from './DebugStream'
import { RecordingsList } from './RecordingsList'
import { TeachModeStorageClient } from '@/lib/teach-mode/storage/TeachModeStorageClient'
import { VoiceRecordingService } from '@/lib/services/VoiceRecordingService'

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
  onPlayRecording?: (recordingId: string) => void
}

/**
 * Main view for Teach Mode functionality
 * Self-contained component for recording, debugging, and managing recordings
 */
export function TeachModeView({ onBack, onPlayRecording }: TeachModeViewProps = {}) {
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTabId, setRecordingTabId] = useState<number | undefined>()
  const [recordings, setRecordings] = useState<StorageMetadata[]>([])
  const [debugMessages, setDebugMessages] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [voiceEnabled, setVoiceEnabled] = useState(false)
  const [voiceService] = useState(() => VoiceRecordingService.getInstance())
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
  const handleStartRecording = async (options?: { captureVoice?: boolean }) => {
    try {
      setError(null)

      // Get current tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      if (!tab.id) {
        setError('No active tab found')
        return
      }

      // Send start message with voice option
      const response = await new Promise<any>((resolve) => {
        chrome.runtime.sendMessage(
          {
            action: 'TEACH_MODE_START',
            tabId: tab.id,
            options: {
              captureVoice: options?.captureVoice || false
            }
          },
          resolve
        )
      })

      if (response?.success) {
        setIsRecording(true)
        setRecordingTabId(tab.id)
        const voiceWillRecord = options?.captureVoice || false
        setVoiceEnabled(voiceWillRecord)
        setDebugMessages([]) // Clear debug messages for new recording
        seenMessageIds.current.clear() // Clear seen message IDs

        // Start voice recording in sidepanel context if enabled
        if (voiceWillRecord) {
          try {
            console.log('Starting voice recording in sidepanel context...')
            await voiceService.startRecording()
            console.log('Voice recording started successfully')
          } catch (error) {
            console.error('Failed to start voice recording:', error)
            const errorMsg = error instanceof Error ? error.message : String(error)
            if (errorMsg.includes('Permission denied') || errorMsg.includes('denied')) {
              setError('🎤 Microphone access was denied. Please check your browser settings.')
            } else if (errorMsg.includes('dismissed')) {
              setError('🎤 Microphone permission was dismissed. Look for the microphone icon 🎤 in your browser address bar and click "Allow" to enable voice recording.')
            } else {
              setError(`Voice recording failed: ${errorMsg}`)
            }
            setVoiceEnabled(false) // Reset voice state on error
          }
        }
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
        const wasVoiceEnabled = voiceEnabled
        setIsRecording(false)
        setRecordingTabId(undefined)
        setVoiceEnabled(false)
        seenMessageIds.current.clear() // Clear seen message IDs

        // Stop voice recording and send data to background if it was active
        if (wasVoiceEnabled && voiceService.isVoiceRecording()) {
          try {
            const voiceResult = await voiceService.stopRecording()
            console.log('Stopped voice recording, sending data to background')

            // Send voice data to background service
            await new Promise<void>((resolve) => {
              chrome.runtime.sendMessage({
                action: 'TEACH_MODE_SET_VOICE_DATA',
                voiceData: {
                  transcript: voiceResult.transcript,
                  duration: voiceResult.duration,
                  segments: voiceResult.segments,
                  vapiSessionId: voiceResult.vapiSessionId
                }
              }, () => resolve())
            })
          } catch (error) {
            console.error('Failed to stop voice recording:', error)
            setError('Failed to process voice recording')
          }
        }

        // Small delay to allow voice data processing
        setTimeout(async () => {
          // Reload recordings to show the new one
          await loadRecordings()
        }, 500)
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

  // Handle play recording
  const handlePlayRecording = async (recordingId: string) => {
    try {
      setError(null)
      console.log('Playing recording:', recordingId)

      // Get workflow from recording ID
      const response = await new Promise<any>((resolve) => {
        chrome.runtime.sendMessage(
          { action: 'GET_WORKFLOW', recordingId },
          resolve
        )
      })

      if (!response?.success || !response.workflow) {
        setError('Workflow not found for this recording')
        return
      }

      const workflow = response.workflow

      // Execute workflow with TeachAgent
      const executeResponse = await new Promise<any>((resolve) => {
        chrome.runtime.sendMessage(
          { action: 'EXECUTE_WORKFLOW', workflow },
          resolve
        )
      })

      if (executeResponse?.success) {
        // Navigate back to chat view to show execution
        onPlayRecording?.(recordingId)
      } else {
        setError(executeResponse?.error || 'Failed to execute workflow')
      }
    } catch (err) {
      console.error('Failed to play recording:', err)
      setError('Failed to play recording')
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
          voiceEnabled={voiceEnabled}
          onStart={handleStartRecording}
          onStop={handleStopRecording}
          onVoiceToggle={setVoiceEnabled}
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
          onPlay={handlePlayRecording}
          onRefresh={loadRecordings}
        />
      </div>
    </div>
  )
}