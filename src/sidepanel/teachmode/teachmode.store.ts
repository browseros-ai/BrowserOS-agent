import { create } from 'zustand'
import type { TeachModeState, TeachModeRecording, CapturedEvent, ExecutionProgress, ExecutionSummary } from './teachmode.types'
import type { TeachModeEventPayload } from '@/lib/pubsub/types'
import { MessageType } from '@/lib/types/messaging'

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
  executionMessages: Array<{ msgId: string; type: string; content: string; timestamp: number }>
  recordingStartTime: number | null
  isRecordingActive: boolean
  currentSessionId: string | null
  preprocessingStatus: {
    isProcessing: boolean
    progress: number
    total: number
    message: string
  } | null
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
  executeRecording: (id: string) => Promise<void>
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
  executionMessages: [],
  recordingStartTime: null,
  isRecordingActive: false,
  currentSessionId: null,
  preprocessingStatus: null,
  // VAPI state
  transcripts: [],
  vapiStatus: 'idle',

  // Actions
  setMode: (mode) => set({ mode }),

  prepareRecording: () => set({
    mode: 'recording',
    recordingEvents: [],
    recordingStartTime: null,
    isRecordingActive: false,
    transcripts: [],
    vapiStatus: 'idle'
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
        type: MessageType.TEACH_MODE_START,
        payload: { tabId: tab.id }
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
        type: MessageType.TEACH_MODE_STOP,
        payload: {}
      })

      if (response?.success) {
        set({
          mode: 'processing',
          isRecordingActive: false,
          preprocessingStatus: {
            isProcessing: true,
            progress: 0,
            total: 0,
            message: 'Saving recording...'
          }
        })
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
      chrome.runtime.sendMessage({ type: MessageType.TEACH_MODE_STOP, payload: {} }).catch(() => {})
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
        type: MessageType.TEACH_MODE_DELETE,
        payload: { recordingId: id }
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

  executeRecording: async (id) => {
    const recording = get().recordings.find(r => r.id === id)
    if (!recording) return

    try {
      // Set initial execution state (we don't know total steps yet)
      set({
        mode: 'executing',
        activeRecording: recording,
        executionMessages: [],  // Clear previous messages
        executionProgress: {
          recordingId: id,
          currentStep: 0,
          totalSteps: 0,  // Will be updated by backend when workflow is loaded
          status: 'running',
          startedAt: Date.now(),
          completedSteps: []
        }
      })

      // Send execution request with just the workflow ID
      // Backend will retrieve the workflow from storage and execute it
      const executeResponse = await chrome.runtime.sendMessage({
        type: MessageType.EXECUTE_TEACH_MODE_WORKFLOW,
        payload: { workflowId: id }
      })

      if (executeResponse?.success) {
        // Execution started successfully
        // Progress will be handled via PubSub events
        console.log('Workflow execution started for recording:', id)
      } else {
        // Execution failed to start
        console.error('Failed to execute workflow:', executeResponse?.error)
        set({
          mode: 'summary',
          executionSummary: {
            recordingId: id,
            recordingName: recording.name,
            success: false,
            duration: 0,
            stepsCompleted: 0,
            totalSteps: 0,  // We don't know the total steps since we didn't load the workflow
            results: [executeResponse?.error || 'Failed to execute workflow']
          }
        })
      }
    } catch (error) {
      console.error('Failed to execute recording:', error)
      set({ mode: 'idle' })
    }
  },

  setActiveRecording: (recording) => set({ activeRecording: recording }),

  setExecutionProgress: (progress) => set({ executionProgress: progress }),

  setExecutionSummary: (summary) => set({ executionSummary: summary }),

  reset: () => set({
    mode: 'idle',
    recordingEvents: [],
    executionProgress: null,
    executionSummary: null,
    executionMessages: [],
    activeRecording: null,
    recordingStartTime: null,
    isRecordingActive: false,
    currentSessionId: null,
    preprocessingStatus: null,
    transcripts: [],
    vapiStatus: 'idle'
  }),

  loadRecordings: async () => {
    try {
      const response = await chrome.runtime.sendMessage({
        type: MessageType.TEACH_MODE_LIST,
        payload: {}
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

    // Handle preprocessing events regardless of session (they happen after recording stops)
    const isPreprocessingEvent = [
      'preprocessing_started',
      'preprocessing_progress',
      'preprocessing_completed',
      'preprocessing_failed'
    ].includes(payload.eventType)

    // Handle execution events regardless of session
    const isExecutionEvent = [
      'execution_started',
      'execution_thinking',
      'execution_step_started',
      'execution_step_completed',
      'execution_completed',
      'execution_failed'
    ].includes(payload.eventType)

    // Only handle events for current session (except preprocessing, execution, and recording_started)
    if (!isPreprocessingEvent &&
        !isExecutionEvent &&
        payload.sessionId !== state.currentSessionId &&
        payload.eventType !== 'recording_started') {
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

      case 'preprocessing_started':
        set({
          mode: 'processing',
          preprocessingStatus: {
            isProcessing: true,
            progress: 0,
            total: payload.data.totalEvents,
            message: 'Analyzing your workflow...'
          }
        })
        break

      case 'preprocessing_progress':
        set(state => ({
          preprocessingStatus: state.preprocessingStatus ? {
            ...state.preprocessingStatus,
            progress: payload.data.current,
            message: payload.data.message
          } : null
        }))
        break

      case 'preprocessing_completed':
        set({
          mode: 'idle',
          preprocessingStatus: null,
          recordingEvents: [],
          recordingStartTime: null,
          currentSessionId: null
        })
        // Reload recordings to get the new workflow
        get().loadRecordings()
        break

      case 'preprocessing_failed':
        set({
          mode: 'idle',
          preprocessingStatus: null,
          recordingEvents: [],
          recordingStartTime: null,
          currentSessionId: null
        })
        // Still reload recordings (raw recording was saved)
        get().loadRecordings()
        break

      case 'transcript_update':
        // Handle transcript updates if needed
        break

      case 'execution_started':
        // Execution started event - clear messages from previous executions
        set(state => ({
          executionMessages: [],  // Clear previous execution messages
          executionProgress: state.executionProgress ? {
            ...state.executionProgress,
            status: 'running',
            currentStep: 0,
            totalSteps: payload.data.totalSteps || state.executionProgress.totalSteps
          } : null
        }))
        break

      case 'execution_thinking':
        // Store thinking/reasoning messages for display with deduplication
        set(state => {
          const msgId = payload.data.msgId || `thinking_${payload.data.timestamp}`;

          // Check if message with this msgId already exists
          const existingIndex = state.executionMessages.findIndex(msg => msg.msgId === msgId);

          if (existingIndex !== -1) {
            // Update existing message
            const updatedMessages = [...state.executionMessages];
            updatedMessages[existingIndex] = {
              msgId,
              type: 'thinking',
              content: payload.data.content,
              timestamp: payload.data.timestamp
            };
            return { executionMessages: updatedMessages };
          } else {
            // Add new message
            return {
              executionMessages: [
                ...state.executionMessages,
                {
                  msgId,
                  type: 'thinking',
                  content: payload.data.content,
                  timestamp: payload.data.timestamp
                }
              ]
            };
          }
        })
        break

      case 'execution_step_started':
        // Step started event with description
        set(state => ({
          executionProgress: state.executionProgress ? {
            ...state.executionProgress,
            currentStep: payload.data.currentStep,
            totalSteps: payload.data.totalSteps || state.executionProgress.totalSteps,
            currentMessage: payload.data.stepDescription || payload.data.message
          } : null
        }))
        break

      case 'execution_step_completed':
        // Step completed event
        set(state => {
          if (!state.executionProgress) return state

          const completedStep = {
            stepNumber: state.executionProgress.currentStep,
            success: true,
            duration: Date.now() - state.executionProgress.startedAt,
            message: payload.data.message || `Step ${state.executionProgress.currentStep} completed`
          }

          return {
            executionProgress: {
              ...state.executionProgress,
              completedSteps: [...state.executionProgress.completedSteps, completedStep]
            }
          }
        })
        break

      case 'execution_completed':
        // Execution completed successfully
        set(state => {
          const recording = state.activeRecording
          if (!recording) return { mode: 'idle' }

          return {
            mode: 'summary',
            executionSummary: {
              recordingId: recording.id,
              recordingName: recording.name,
              success: true,
              duration: state.executionProgress ?
                Math.floor((Date.now() - state.executionProgress.startedAt) / 1000) : 0,
              stepsCompleted: state.executionProgress?.completedSteps.length || 0,
              totalSteps: state.executionProgress?.totalSteps || 0,
              results: [payload.data.message || 'Workflow executed successfully']
            },
            executionProgress: null
          }
        })
        break

      case 'execution_failed':
        // Execution failed
        set(state => {
          const recording = state.activeRecording
          if (!recording) return { mode: 'idle' }

          return {
            mode: 'summary',
            executionSummary: {
              recordingId: recording.id,
              recordingName: recording.name,
              success: false,
              duration: state.executionProgress ?
                Math.floor((Date.now() - state.executionProgress.startedAt) / 1000) : 0,
              stepsCompleted: state.executionProgress?.completedSteps.length || 0,
              totalSteps: state.executionProgress?.totalSteps || 0,
              results: [payload.data.error || 'Workflow execution failed']
            },
            executionProgress: null
          }
        })
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
