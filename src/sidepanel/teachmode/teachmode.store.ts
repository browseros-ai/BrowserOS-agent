import { create } from 'zustand'
import type { TeachModeState, TeachModeRecording, CapturedEvent, ExecutionProgress, ExecutionSummary } from './teachmode.types'
import type { TeachModeEventPayload } from '@/lib/pubsub/types'
import type { SemanticWorkflow } from '@/lib/teach-mode/types'
import { MessageType } from '@/lib/types/messaging'
import { PortMessaging } from '@/lib/runtime/PortMessaging'

type voiceStatus = 'idle' | 'connecting' | 'connected' | 'transcribing' | 'error'

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
    actionType?: string  // Current action being processed
    message: string
  } | null
  // Voice integration state
  voiceStatus: voiceStatus
  // Port messaging instance
  portMessaging: PortMessaging | null
  isPortMessagingInitialized: boolean  // Tracks if port messaging is ready
  // Cached semantic workflow for active recording
  activeWorkflow: SemanticWorkflow | null

  // Actions
  setMode: (mode: TeachModeState) => void
  prepareRecording: () => void
  startRecording: () => Promise<void>
  stopRecording: (audioDataBase64?: string) => Promise<void>
  cancelRecording: () => void
  addEvent: (event: CapturedEvent) => void
  saveRecording: (recording: TeachModeRecording) => void
  deleteRecording: (id: string) => Promise<void>
  executeRecording: (id: string) => Promise<void>
  abortExecution: () => void
  setActiveRecording: (recording: TeachModeRecording | null) => void
  setExecutionProgress: (progress: ExecutionProgress | null) => void
  setExecutionSummary: (summary: ExecutionSummary | null) => void
  reset: () => void
  loadRecordings: () => Promise<void>
  getWorkflow: (recordingId: string) => Promise<SemanticWorkflow | null>
  updateWorkflow: (recordingId: string, updates: Partial<SemanticWorkflow>) => Promise<boolean>
  handleBackendEvent: (payload: TeachModeEventPayload) => void
  setVoiceStatus: (status: voiceStatus) => void
  // Port messaging setup
  initializePortMessaging: () => void
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
  // Voice state
  voiceStatus: 'idle',
  // Port messaging
  portMessaging: null,
  isPortMessagingInitialized: false,
  activeWorkflow: null,

  // Actions
  setMode: (mode) => set({ mode }),

  prepareRecording: () => set({
    mode: 'recording',
    recordingEvents: [],
    recordingStartTime: null,
    isRecordingActive: false,
    voiceStatus: 'idle'
  }),

  startRecording: async () => {
    const { portMessaging } = get()
    if (!portMessaging) {
      throw new Error('Port messaging not initialized')
    }

    try {
      // Get current tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      if (!tab.id) {
        throw new Error('No active tab found')
      }

      // Send start message to backend via port
      const response = await portMessaging.sendMessageWithResponse<any>(
        MessageType.TEACH_MODE_START,
        { tabId: tab.id }
      )

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

  stopRecording: async (audioDataBase64?: string) => {
    const { portMessaging } = get()
    if (!portMessaging) {
      throw new Error('Port messaging not initialized')
    }

    try {
      // Send stop message to backend with audio data
      const response = await portMessaging.sendMessageWithResponse<any>(
        MessageType.TEACH_MODE_STOP,
        { audioData: audioDataBase64 }
      )

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
    const { portMessaging, isRecordingActive } = get()

    // Try to stop backend recording if active
    if (isRecordingActive && portMessaging) {
      portMessaging.sendMessage(MessageType.TEACH_MODE_STOP, {})
    }

    set({
      mode: 'idle',
      recordingEvents: [],
      recordingStartTime: null,
      isRecordingActive: false,
      activeRecording: null,
      currentSessionId: null,
      voiceStatus: 'idle'
    })
  },

  addEvent: (event) => set((state) => ({
    recordingEvents: [...state.recordingEvents, event]
  })),

  saveRecording: (recording) => set((state) => ({
    recordings: [...state.recordings, recording]
  })),

  deleteRecording: async (id) => {
    const { portMessaging } = get()
    if (!portMessaging) {
      throw new Error('Port messaging not initialized')
    }

    try {
      const response = await portMessaging.sendMessageWithResponse<any>(
        MessageType.TEACH_MODE_DELETE,
        { recordingId: id }
      )

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
      const { portMessaging } = get()
      if (!portMessaging) {
        throw new Error('Port messaging not initialized')
      }

      // Send execution request - now returns immediately
      const executeResponse = await portMessaging.sendMessageWithResponse<any>(
        MessageType.EXECUTE_TEACH_MODE_WORKFLOW,
        { workflowId: id },
        5000  // 5 second timeout - just for the initial response
      )

      if (executeResponse?.success) {
        // Execution started successfully
        // The execution will run in the background and send progress updates via PubSub
        // Completion will be handled by execution_completed/execution_failed events
        console.log('Workflow execution started for recording:', id)
      } else {
        // Failed to start execution (setup error)
        console.error('Failed to start workflow execution:', executeResponse?.error)
        set({
          mode: 'summary',
          executionSummary: {
            recordingId: id,
            recordingName: recording.name,
            success: false,
            duration: 0,
            stepsCompleted: 0,
            totalSteps: 0,
            results: [executeResponse?.error || 'Failed to start workflow execution']
          }
        })
      }
    } catch (error) {
      // Network or communication error (couldn't even start)
      console.error('Failed to communicate with background service:', error)
      set({
        mode: 'summary',
        executionSummary: {
          recordingId: id,
          recordingName: recording.name,
          success: false,
          duration: 0,
          stepsCompleted: 0,
          totalSteps: 0,
          results: ['Failed to communicate with background service. Please try again.']
        }
      })
    }
  },

  abortExecution: () => {
    const { portMessaging, activeRecording, executionProgress } = get()
    if (!portMessaging) {
      console.error('Port messaging not initialized')
      return
    }

    // Send cancel message to background
    portMessaging.sendMessage(MessageType.CANCEL_TASK, {
      reason: 'User aborted teach mode execution',
      source: 'teachmode'
    })

    // Update UI state to show summary with aborted status
    if (activeRecording && executionProgress) {
      set({
        mode: 'summary',
        executionSummary: {
          recordingId: activeRecording.id,
          recordingName: activeRecording.name,
          success: false,
          duration: Math.floor((Date.now() - executionProgress.startedAt) / 1000),
          stepsCompleted: executionProgress.completedSteps.length,
          totalSteps: executionProgress.totalSteps,
          results: ['Execution aborted by user']
        },
        executionProgress: null
      })
    } else {
      // Fallback if no active recording
      set({
        mode: 'idle',
        executionProgress: null
      })
    }
  },

  setActiveRecording: (recording) => set({
    activeRecording: recording,
    activeWorkflow: null  // Clear cached workflow when switching recordings
  }),

  setExecutionProgress: (progress) => set({ executionProgress: progress }),

  setExecutionSummary: (summary) => set({ executionSummary: summary }),

  reset: () => set({
    mode: 'idle',
    recordingEvents: [],
    executionProgress: null,
    executionSummary: null,
    executionMessages: [],
    activeRecording: null,
    activeWorkflow: null,
    recordingStartTime: null,
    isRecordingActive: false,
    currentSessionId: null,
    preprocessingStatus: null,
    voiceStatus: 'idle'
  }),

  loadRecordings: async () => {
    const { portMessaging, getWorkflow } = get()
    if (!portMessaging) {
      throw new Error('Port messaging not initialized')
    }

    try {
      const response = await portMessaging.sendMessageWithResponse<any>(
        MessageType.TEACH_MODE_LIST,
        {}
      )

      if (response?.success && response.recordings) {
        // Convert backend format to UI format
        const recordings: TeachModeRecording[] = await Promise.all(response.recordings.map(async (rec: any) => {
          let stepCount = rec.stepCount

          // Migration: if stepCount is missing or 0, try to fetch workflow to get actual count
          if (stepCount === undefined || stepCount === 0) {
            const workflow = await getWorkflow(rec.id)
            if (workflow?.steps) {
              stepCount = workflow.steps.length
            } else {
              stepCount = 0
            }
          }

          // Create placeholder steps array with correct length for UI display
          const steps = Array(stepCount).fill(null).map((_, i) => ({
            id: `placeholder-${i}`,
            timestamp: 0,
            stepNumber: i + 1,
            action: {
              type: 'click' as const,
              description: '',
            }
          }))

          return {
            id: rec.id,
            name: rec.title || 'Untitled Recording',
            description: rec.description || `${rec.eventCount} events captured`,
            intent: rec.description || '',
            icon: '🎯',
            steps,
            duration: Math.floor((rec.endTimestamp - rec.startTimestamp) / 1000),
            createdAt: rec.createdAt,
            runCount: 0,
            successCount: 0,
            failureCount: 0
          }
        }))

        set({ recordings })
      }
    } catch (error) {
      console.error('Failed to load recordings:', error)
    }
  },

  getWorkflow: async (recordingId: string): Promise<SemanticWorkflow | null> => {
    const { portMessaging } = get()
    if (!portMessaging) {
      throw new Error('Port messaging not initialized')
    }

    try {
      const response = await portMessaging.sendMessageWithResponse<any>(
        MessageType.TEACH_MODE_GET_WORKFLOW,
        { recordingId }
      )

      if (response?.success && response.workflow) {
        // Cache the workflow if it's for the active recording
        const activeRecording = get().activeRecording
        if (activeRecording?.id === recordingId) {
          set({ activeWorkflow: response.workflow })
        }
        return response.workflow as SemanticWorkflow
      }
      return null
    } catch (error) {
      console.error('Failed to get workflow:', error)
      return null
    }
  },

  updateWorkflow: async (recordingId: string, updates: Partial<SemanticWorkflow>): Promise<boolean> => {
    const { portMessaging } = get()
    if (!portMessaging) {
      throw new Error('Port messaging not initialized')
    }

    try {
      const response = await portMessaging.sendMessageWithResponse<any>(
        MessageType.TEACH_MODE_UPDATE_WORKFLOW,
        { recordingId, updates }
      )

      if (response?.success) {
        // Update cached workflow if it's the active one
        const activeRecording = get().activeRecording
        const activeWorkflow = get().activeWorkflow
        if (activeRecording?.id === recordingId && activeWorkflow) {
          // Merge updates with existing workflow
          const updatedWorkflow: SemanticWorkflow = {
            ...activeWorkflow,
            metadata: {
              ...activeWorkflow.metadata,
              ...(updates.metadata || {})
            },
            steps: updates.steps || activeWorkflow.steps
          }
          set({ activeWorkflow: updatedWorkflow })
        }
        return true
      }
      return false
    } catch (error) {
      console.error('Failed to update workflow:', error)
      return false
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
            progress: payload.data.current !== undefined ? payload.data.current : state.preprocessingStatus.progress,
            total: payload.data.total !== undefined ? payload.data.total : state.preprocessingStatus.total,
            actionType: payload.data.actionType || state.preprocessingStatus.actionType,
            message: payload.data.message || state.preprocessingStatus.message
          } : null
        }))
        break

      case 'preprocessing_completed':
        // Get the recording ID from the event data
        const recordingId = payload.data?.recordingId

        // Clear processing state and return to home
        set({
          mode: 'idle',
          preprocessingStatus: null,
          recordingEvents: [],
          recordingStartTime: null,
          currentSessionId: null
        })

        // Load recordings and set the new recording as active
        get().loadRecordings().then(async () => {
          const recordings = get().recordings
          const newRecording = recordings.find(r => r.id === recordingId)
          if (newRecording) {
            // Set as active recording so detail view can display it
            set({ activeRecording: newRecording })
            // Preload the workflow for immediate display
            await get().getWorkflow(recordingId)
          }
        })
        break

      case 'preprocessing_failed':
        // Get the recording ID from the event data if available
        const failedRecordingId = payload.data?.recordingId

        // Return to home even if processing failed
        if (failedRecordingId) {
          set({
            mode: 'idle',
            preprocessingStatus: null,
            recordingEvents: [],
            recordingStartTime: null,
            currentSessionId: null
          })

          // Load recordings and set the failed recording as active
          get().loadRecordings().then(async () => {
            const recordings = get().recordings
            const failedRecording = recordings.find(r => r.id === failedRecordingId)
            if (failedRecording) {
              set({ activeRecording: failedRecording })
              // Try to get workflow (might be partial)
              await get().getWorkflow(failedRecordingId)
            }
          })
        } else {
          // No recording ID, go back to home
          set({
            mode: 'idle',
            preprocessingStatus: null,
            recordingEvents: [],
            recordingStartTime: null,
            currentSessionId: null
          })
          // Still reload recordings (raw recording may have been saved)
          get().loadRecordings()
        }
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

      // Step tracking removed - workflow steps are guidance, not executable steps

      // The agent uses 'execution_thinking' events for all progress updates

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

  // Voice actions
  setVoiceStatus: (status) => set({
    voiceStatus: status
  }),

  // Initialize port messaging
  initializePortMessaging: () => {
    const portMessaging = PortMessaging.getInstance()
    set({ portMessaging, isPortMessagingInitialized: true })
  }
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
