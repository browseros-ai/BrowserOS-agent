import { create } from 'zustand'
import type { TeachModeState, TeachModeRecording, CapturedEvent, ExecutionProgress, ExecutionSummary } from './teachmode.types'

// Dummy recordings data
const DUMMY_RECORDINGS: TeachModeRecording[] = [
  {
    id: 'rec_1',
    name: 'Email Cleanup',
    description: 'Unsubscribe from marketing',
    intent: 'Unsubscribe from marketing emails',
    icon: '📧',
    steps: [
      {
        id: 'step_1_1',
        timestamp: Date.now() - 7200000,
        stepNumber: 1,
        action: {
          type: 'navigate',
          description: 'Navigate to Gmail',
          url: 'gmail.com'
        },
        voiceAnnotation: 'Open my email inbox',
        screenshot: 'data:image/png;base64,dummy'
      },
      {
        id: 'step_1_2',
        timestamp: Date.now() - 7195000,
        stepNumber: 2,
        action: {
          type: 'click',
          description: 'Clicked "Promotions"',
          element: 'Tab selector'
        },
        voiceAnnotation: 'Go to promotional emails',
        screenshot: 'data:image/png;base64,dummy'
      },
      {
        id: 'step_1_3',
        timestamp: Date.now() - 7190000,
        stepNumber: 3,
        action: {
          type: 'click',
          description: 'Open first email',
          element: 'Email item'
        },
        voiceAnnotation: 'Open the first marketing email'
      },
      {
        id: 'step_1_4',
        timestamp: Date.now() - 7185000,
        stepNumber: 4,
        action: {
          type: 'click',
          description: 'Click unsubscribe',
          element: 'Unsubscribe link'
        },
        voiceAnnotation: 'Find and click the unsubscribe link'
      },
      {
        id: 'step_1_5',
        timestamp: Date.now() - 7180000,
        stepNumber: 5,
        action: {
          type: 'click',
          description: 'Confirm unsubscription',
          element: 'Confirm button'
        },
        voiceAnnotation: 'Confirm the unsubscription'
      }
    ],
    duration: 83,
    createdAt: Date.now() - 7200000,
    lastRunAt: Date.now() - 7200000,
    runCount: 5,
    successCount: 4,
    failureCount: 1
  },
  {
    id: 'rec_2',
    name: 'Daily Report',
    description: 'Extract metrics to sheets',
    intent: 'Extract daily metrics and save to Google Sheets',
    icon: '📊',
    steps: Array.from({ length: 8 }, (_, i) => ({
      id: `step_2_${i + 1}`,
      timestamp: Date.now() - 86400000,
      stepNumber: i + 1,
      action: {
        type: 'click' as const,
        description: `Step ${i + 1} of workflow`,
        element: 'Element'
      }
    })),
    duration: 165,
    createdAt: Date.now() - 86400000,
    lastRunAt: Date.now() - 86400000,
    runCount: 12,
    successCount: 12,
    failureCount: 0
  },
  {
    id: 'rec_3',
    name: 'Price Monitor',
    description: 'Check product prices',
    intent: 'Monitor product prices on e-commerce sites',
    icon: '🔍',
    steps: Array.from({ length: 3 }, (_, i) => ({
      id: `step_3_${i + 1}`,
      timestamp: Date.now() - 259200000,
      stepNumber: i + 1,
      action: {
        type: 'navigate' as const,
        description: `Navigate to page ${i + 1}`,
        url: `site${i + 1}.com`
      }
    })),
    duration: 45,
    createdAt: Date.now() - 259200000,
    lastRunAt: Date.now() - 259200000,
    runCount: 8,
    successCount: 6,
    failureCount: 2
  }
]

interface TeachModeStore {
  // State
  mode: TeachModeState
  recordings: TeachModeRecording[]
  activeRecording: TeachModeRecording | null
  recordingEvents: CapturedEvent[]
  executionProgress: ExecutionProgress | null
  executionSummary: ExecutionSummary | null
  recordingStartTime: number | null

  // Actions
  setMode: (mode: TeachModeState) => void
  startRecording: () => void
  stopRecording: () => void
  addEvent: (event: CapturedEvent) => void
  saveRecording: (recording: TeachModeRecording) => void
  deleteRecording: (id: string) => void
  executeRecording: (id: string) => void
  setActiveRecording: (recording: TeachModeRecording | null) => void
  setExecutionProgress: (progress: ExecutionProgress | null) => void
  setExecutionSummary: (summary: ExecutionSummary | null) => void
  reset: () => void
}

export const useTeachModeStore = create<TeachModeStore>((set, get) => ({
  // Initial state with dummy data
  mode: 'idle',
  recordings: DUMMY_RECORDINGS,
  activeRecording: null,
  recordingEvents: [],
  executionProgress: null,
  executionSummary: null,
  recordingStartTime: null,

  // Actions
  setMode: (mode) => set({ mode }),

  startRecording: () => set({
    mode: 'recording',
    recordingEvents: [],
    recordingStartTime: Date.now()
  }),

  stopRecording: () => {
    const state = get()
    // Simulate processing
    set({ mode: 'processing' })

    // Simulate processing delay then go to detail view
    setTimeout(() => {
      const newRecording: TeachModeRecording = {
        id: `rec_${Date.now()}`,
        name: 'New Workflow',
        description: 'Automated workflow',
        intent: 'Automated workflow',
        icon: '🎯',
        steps: state.recordingEvents,
        duration: Math.floor((Date.now() - (state.recordingStartTime || Date.now())) / 1000),
        createdAt: Date.now(),
        runCount: 0,
        successCount: 0,
        failureCount: 0
      }

      set({
        mode: 'ready',
        activeRecording: newRecording,
        recordings: [...get().recordings, newRecording]
      })
    }, 3000)
  },

  addEvent: (event) => set((state) => ({
    recordingEvents: [...state.recordingEvents, event]
  })),

  saveRecording: (recording) => set((state) => ({
    recordings: [...state.recordings, recording]
  })),

  deleteRecording: (id) => set((state) => ({
    recordings: state.recordings.filter(r => r.id !== id)
  })),

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
    recordingStartTime: null
  })
}))