import { create } from 'zustand'
import type { TeachModeState, TeachModeRecording, CapturedEvent, ExecutionProgress, ExecutionSummary } from './teachmode.types'
import type { TeachModeEventPayload } from '@/lib/pubsub/types'

interface VapiTranscript {
  timestamp: number
  text: string
  isFinal: boolean
}

type VapiStatus = 'idle' | 'connecting' | 'connected' | 'error'

interface TeachModeStore {
  // State
  mode: TeachModeState
  recordings: TeachModeRecording[]
  activeRecording: TeachModeRecording | null
  recordingEvents: CapturedEvent[]
  executionProgress: ExecutionProgress | null
  executionSummary: ExecutionSummary | null
  recordingStartTime: number | null
  isRecordingActive: boolean
  currentSessionId: string | null
  // VAPI integration state
  transcripts: VapiTranscript[]
  vapiStatus: VapiStatus

  // Actions
  setMode: (mode: TeachModeState) => void
  prepareRecording: () => void
  startRecording: () => Promise<void>
  stopRecording: () => Promise<void>
  cancelRecording: () => void
  addEvent: (event: CapturedEvent) => void
  saveRecording: (recording: TeachModeRecording) => void
  deleteRecording: (id: string) => Promise<void>
  executeRecording: (id: string) => void
  setActiveRecording: (recording: TeachModeRecording | null) => void
  setExecutionProgress: (progress: ExecutionProgress | null) => void
  setExecutionSummary: (summary: ExecutionSummary | null) => void
  reset: () => void
  loadRecordings: () => Promise<void>
  handleBackendEvent: (payload: TeachModeEventPayload) => void
  // VAPI actions
  addTranscript: (transcript: VapiTranscript) => void
  clearTranscripts: () => void
  setVapiStatus: (status: VapiStatus) => void
}

export const useTeachModeStore = create<TeachModeStore>((set, get) => ({
  // Initial state
  mode: 'idle',
  recordings: [],
  activeRecording: null,
  recordingEvents: [],
  executionProgress: null,
  executionSummary: null,
  recordingStartTime: null,
  isRecordingActive: false,
  currentSessionId: null,
  // VAPI state
  transcripts: [],
  vapiStatus: 'idle',

  // Actions
  setMode: (mode) => set({ mode }),

  prepareRecording: () => set({
    mode: 'recording',
    recordingEvents: [],
    recordingStartTime: null,
    isRecordingActive: false
  }),

  startRecording: async () => {
    try {
      // Get current tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      if (!tab.id) {
        throw new Error('No active tab found')
      }

      // Send start message to backend
      const response = await chrome.runtime.sendMessage({
        action: 'TEACH_MODE_START',
        tabId: tab.id
      })

      if (response?.success) {
        set({
          isRecordingActive: true,
          recordingEvents: [],
          recordingStartTime: Date.now(),
          currentSessionId: response.sessionId || `recording_${Date.now()}`
        })
      } else {
        throw new Error(response?.error || 'Failed to start recording')
      }
    } catch (error) {
      console.error('Failed to start recording:', error)
      throw error
    }
  },

  stopRecording: async () => {
    try {
      // Send stop message to backend
      const response = await chrome.runtime.sendMessage({
        action: 'TEACH_MODE_STOP'
      })

      if (response?.success) {
        set({
          mode: 'processing',
          isRecordingActive: false
        })

        // Load updated recordings after stopping
        setTimeout(async () => {
          await get().loadRecordings()
          set({
            mode: 'idle',
            recordingEvents: [],
            recordingStartTime: null,
            currentSessionId: null
          })
        }, 1000)
      } else {
        throw new Error(response?.error || 'Failed to stop recording')
      }
    } catch (error) {
      console.error('Failed to stop recording:', error)
      set({ isRecordingActive: false, mode: 'idle' })
      throw error
    }
  },

  cancelRecording: () => {
    // Try to stop backend recording if active
    if (get().isRecordingActive) {
      chrome.runtime.sendMessage({ action: 'TEACH_MODE_STOP' }).catch(() => {})
    }

    set({
      mode: 'idle',
      recordingEvents: [],
      recordingStartTime: null,
      isRecordingActive: false,
      activeRecording: null,
      currentSessionId: null,
      transcripts: [],
      vapiStatus: 'idle'
    })
  },

  addEvent: (event) => set((state) => ({
    recordingEvents: [...state.recordingEvents, event]
  })),

  saveRecording: (recording) => set((state) => ({
    recordings: [...state.recordings, recording]
  })),

  deleteRecording: async (id) => {
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'TEACH_MODE_DELETE',
        recordingId: id
      })

      if (response?.success) {
        set((state) => ({
          recordings: state.recordings.filter(r => r.id !== id)
        }))
      }
    } catch (error) {
      console.error('Failed to delete recording:', error)
      throw error
    }
  },

  executeRecording: (id) => {
    const recording = get().recordings.find(r => r.id === id)
    if (!recording) return

    set({
      mode: 'executing',
      activeRecording: recording,
      executionProgress: {
        recordingId: id,
        currentStep: 1,
        totalSteps: recording.steps.length,
        status: 'running',
        startedAt: Date.now(),
        completedSteps: []
      }
    })

    // Simulate execution progress
    let step = 1
    const interval = setInterval(() => {
      const progress = get().executionProgress
      if (!progress || step > recording.steps.length) {
        clearInterval(interval)
        // Show summary
        set({
          mode: 'summary',
          executionSummary: {
            recordingId: id,
            recordingName: recording.name,
            success: true,
            duration: 78,
            stepsCompleted: recording.steps.length,
            totalSteps: recording.steps.length,
            results: [
              'Unsubscribed from 3 lists',
              'Deleted 15 emails',
              'Marked 8 as spam'
            ]
          }
        })
        return
      }

      set({
        executionProgress: {
          ...progress,
          currentStep: step,
          completedSteps: [
            ...progress.completedSteps,
            {
              stepNumber: step - 1,
              success: true,
              duration: Math.random() * 2000,
              message: `Completed step ${step - 1}`
            }
          ]
        }
      })
      step++
    }, 2000)
  },

  setActiveRecording: (recording) => set({ activeRecording: recording }),

  setExecutionProgress: (progress) => set({ executionProgress: progress }),

  setExecutionSummary: (summary) => set({ executionSummary: summary }),

  reset: () => set({
    mode: 'idle',
    recordingEvents: [],
    executionProgress: null,
    executionSummary: null,
    activeRecording: null,
    recordingStartTime: null,
    isRecordingActive: false,
    currentSessionId: null,
    transcripts: [],
    vapiStatus: 'idle'
  }),

  loadRecordings: async () => {
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'TEACH_MODE_LIST'
      })

      if (response?.success && response.recordings) {
        // Convert backend format to UI format
        const recordings: TeachModeRecording[] = response.recordings.map((rec: any) => ({
          id: rec.id,
          name: rec.title || 'Untitled Recording',
          description: rec.description || `${rec.eventCount} events captured`,
          intent: rec.description || '',
          icon: '🎯',
          steps: [],  // Will be loaded when needed
          duration: Math.floor((rec.endTime - rec.startTime) / 1000),
          createdAt: rec.createdAt,
          runCount: 0,
          successCount: 0,
          failureCount: 0
        }))

        set({ recordings })
      }
    } catch (error) {
      console.error('Failed to load recordings:', error)
    }
  },

  handleBackendEvent: (payload: TeachModeEventPayload) => {
    const state = get()

    // Only handle events for current session
    if (payload.sessionId !== state.currentSessionId && payload.eventType !== 'recording_started') {
      return
    }

    switch (payload.eventType) {
      case 'recording_started':
        set({ currentSessionId: payload.sessionId })
        break

      case 'event_captured':
        const { event, index } = payload.data
        // Convert backend event to UI format
        const capturedEvent: CapturedEvent = {
          id: event.id,
          timestamp: event.timestamp,
          stepNumber: index + 1,
          action: {
            type: event.action.type,
            description: _formatActionDescription(event.action),
            url: event.action.url,
            element: event.target?.element?.tagName
          },
          voiceAnnotation: event.narration,
          screenshot: event.state?.screenshot
        }
        set((state) => {
          // Check if event with same ID already exists
          const existingIndex = state.recordingEvents.findIndex(e => e.id === capturedEvent.id)
          if (existingIndex !== -1) {
            // Update existing event (might have new screenshot or data)
            const updatedEvents = [...state.recordingEvents]
            updatedEvents[existingIndex] = capturedEvent
            return { recordingEvents: updatedEvents }
          } else {
            // Add new event
            return { recordingEvents: [...state.recordingEvents, capturedEvent] }
          }
        })
        break

      case 'state_captured':
        const { eventId, state: capturedState } = payload.data
        set((state) => {
          // Only update if event exists
          const eventExists = state.recordingEvents.some(e => e.id === eventId)
          if (!eventExists) {
            return state  // Don't update if event doesn't exist
          }
          return {
            recordingEvents: state.recordingEvents.map(e =>
              e.id === eventId
                ? { ...e, screenshot: capturedState.screenshot }
                : e
            )
          }
        })
        break

      case 'recording_stopped':
        // Backend has stopped, update UI
        set({ isRecordingActive: false, currentSessionId: null })
        break

      case 'transcript_update':
        // Handle transcript updates if needed
        break

      case 'tab_switched':
      case 'viewport_updated':
        // Handle these events if needed for UI feedback
        break
    }
  },

  // VAPI actions
  addTranscript: (transcript) => set((state) => ({
    transcripts: [...state.transcripts, transcript]
  })),

  clearTranscripts: () => set({
    transcripts: []
  }),

  setVapiStatus: (status) => set({
    vapiStatus: status
  })
}))

// Helper function to format action description
function _formatActionDescription(action: any): string {
  switch (action.type) {
    case 'click':
    case 'dblclick':
      return `Clicked ${action.target?.element?.tagName || 'element'}`
    case 'input':
    case 'type':
      return `Typed "${action.value || ''}" into field`
    case 'navigation':
    case 'navigate':
      return `Navigated to ${action.url || 'page'}`
    case 'scroll':
      return `Scrolled to position ${action.scroll?.y || 0}`
    case 'tab_switched':
      return `Switched to tab ${action.toTabId}`
    case 'tab_opened':
      return `Opened new tab`
    case 'tab_closed':
      return `Closed tab`
    case 'session_start':
      return 'Started recording'
    case 'session_end':
      return 'Stopped recording'
    default:
      return action.type
  }
}
