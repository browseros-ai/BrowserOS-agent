import { create } from 'zustand'
import { z } from 'zod'
import { MessageType } from '@/lib/types/messaging'
import { PortMessaging } from '@/lib/runtime/PortMessaging'
import { FeedbackSubmissionSchema, type FeedbackSubmission, type FeedbackType } from '@/lib/types/feedback'
import { feedbackService } from '@/lib/services/feedbackService'

// Message schema for chat store with Zod validation
export const MessageSchema = z.object({
  msgId: z.string(),  // Primary ID for both React keys and PubSub correlation
  role: z.enum(['user', 'thinking', 'assistant', 'error', 'plan_editor']), 
  content: z.string(),  // Message content
  timestamp: z.date(),  // When message was created
  metadata: z.object({
    toolName: z.string().optional(),  // Tool name if this is a tool result
  }).optional()  // Minimal metadata
})

export type Message = z.infer<typeof MessageSchema>

// Store state schema
const ChatStateSchema = z.object({
  messages: z.array(MessageSchema),  // All chat messages
  isProcessing: z.boolean(),  // Is agent currently processing
  error: z.string().nullable(),  // Current error message if any
  feedbacks: z.record(z.string(), FeedbackSubmissionSchema),  // messageId -> feedback
  feedbackUI: z.record(z.string(), z.object({
    isSubmitting: z.boolean(),
    showModal: z.boolean(),
    error: z.string().nullable()
  }))  // messageId -> UI state
})

type ChatState = z.infer<typeof ChatStateSchema>

// External message format for upsert operations
export interface PubSubMessage {
  msgId: string
  content: string
  role: 'thinking' | 'user' | 'assistant' | 'error' | 'plan_editor'
  ts: number
}

// Store actions
interface ChatActions {
  // Message operations - now with upsert
  upsertMessage: (pubsubMessage: PubSubMessage) => void
  addMessage: (message: Omit<Message, 'timestamp'>) => void
  updateMessage: (msgId: string, updates: Partial<Message>) => void
  clearMessages: () => void
  
  // Processing state
  setProcessing: (processing: boolean) => void
  
  // Error handling
  setError: (error: string | null) => void
  
  // Feedback operations
  submitFeedback: (messageId: string, type: FeedbackType, textFeedback?: string) => Promise<void>
  getFeedbackForMessage: (messageId: string) => FeedbackSubmission | null
  setFeedbackUIState: (messageId: string, state: Partial<{ isSubmitting: boolean; showModal: boolean; error: string | null }>) => void
  getFeedbackUIState: (messageId: string) => { isSubmitting: boolean; showModal: boolean; error: string | null }
  
  // Plan editing
  publishPlanEditResponse: (response: { planId: string; action: 'execute' | 'cancel'; steps?: any[] }) => void
  executedPlans: Record<string, boolean>
  setPlanExecuted: (planId: string) => void
  
  // Reset everything
  reset: () => void
}

// Initial state
const initialState: ChatState & { executedPlans: Record<string, boolean> } = {
  messages: [],
  isProcessing: false,
  error: null,
  feedbacks: {},
  feedbackUI: {},
  executedPlans: {}
}

// Create the store
export const useChatStore = create<ChatState & ChatActions>((set) => ({
  // State
  ...initialState,
  
  // Actions
  upsertMessage: (pubsubMessage) => {
    set((state) => {
      const existingIndex = state.messages.findIndex(m => m.msgId === pubsubMessage.msgId)
      
      if (existingIndex >= 0) {
        // Update existing message content
        const updated = [...state.messages]
        updated[existingIndex] = {
          ...updated[existingIndex],
          content: pubsubMessage.content,
          timestamp: new Date(pubsubMessage.ts)
        }
        return { 
          messages: updated, 
          error: null
          // Don't change isProcessing when updating existing messages
        }
      } else {
        const newMessage: Message = {
          msgId: pubsubMessage.msgId,
          content: pubsubMessage.content,
          role: pubsubMessage.role,
          timestamp: new Date(pubsubMessage.ts),
          metadata: {}
        }
        return { 
          messages: [...state.messages, newMessage],
          error: null,
          isProcessing: true  // Only set processing when adding new messages
        }
      }
    })
  },

  addMessage: (message) => {
    set((state) => ({
      messages: [...state.messages, { ...message, timestamp: new Date() }]
    }))
  },

  updateMessage: (msgId, updates) => {
    set((state) => ({
      messages: state.messages.map(msg => 
        msg.msgId === msgId ? { ...msg, ...updates } : msg
      )
    }))
  },
  
  clearMessages: () => set({ messages: [] }),
  
  setProcessing: (processing) => set({ isProcessing: processing }),
  
  setError: (error) => set({ error }),
  
  // Send plan edit response to background script
  publishPlanEditResponse: (response) => {
    const messaging = PortMessaging.getInstance()
    const success = messaging.sendMessage(MessageType.PLAN_EDIT_RESPONSE, response)
    if (!success) {
      console.error('Failed to send plan edit response - port not connected')
    }
  },

  setPlanExecuted: (planId) => {
    set((state) => ({
      executedPlans: { ...state.executedPlans, [planId]: true }
    }))
  },

  // Feedback operations
  submitFeedback: async (messageId, type, textFeedback) => {
    // Set submitting state
    set((state) => ({
      feedbackUI: {
        ...state.feedbackUI,
        [messageId]: {
          ...state.feedbackUI[messageId],
          isSubmitting: true,
          error: null
        }
      }
    }))

    try {
      const state = useChatStore.getState()
      const message = state.messages.find((m: Message) => m.msgId === messageId)

      // Find the user message that triggered this agent response
      const messageIndex = state.messages.findIndex((m: Message) => m.msgId === messageId)
      let userQuery = 'No user query found'

      // Look backwards from agent message to find the most recent user message
      for (let i = messageIndex - 1; i >= 0; i--) {
        if (state.messages[i].role === 'user') {
          userQuery = state.messages[i].content
          break
        }
      }

      const feedback: FeedbackSubmission = {
        source: 'agent',
        type,
        user_feedback: textFeedback,
        timestamp: new Date(),
        data: {
          messageId,
          userQuery,
          agentResponse: message?.content
        }
      }

      // Store feedback locally
      set((state) => ({
        feedbacks: { ...state.feedbacks, [messageId]: feedback },
        feedbackUI: {
          ...state.feedbackUI,
          [messageId]: {
            isSubmitting: false,
            showModal: false,
            error: null
          }
        }
      }))

      // Submit to API
      await feedbackService.submitFeedback(feedback)
      
    } catch (error) {
      set((state) => ({
        feedbackUI: {
          ...state.feedbackUI,
          [messageId]: {
            ...state.feedbackUI[messageId],
            isSubmitting: false,
            error: error instanceof Error ? error.message : 'Failed to submit feedback'
          }
        }
      }))
    }
  },

  getFeedbackForMessage: (messageId): FeedbackSubmission | null => {
    const state = useChatStore.getState()
    return state.feedbacks[messageId] || null
  },

  setFeedbackUIState: (messageId, newState) => {
    set((state) => ({
      feedbackUI: {
        ...state.feedbackUI,
        [messageId]: {
          ...state.feedbackUI[messageId],
          ...newState
        }
      }
    }))
  },

  getFeedbackUIState: (messageId): { isSubmitting: boolean; showModal: boolean; error: string | null } => {
    const state = useChatStore.getState()
    const uiState = state.feedbackUI[messageId]
    return uiState || { isSubmitting: false, showModal: false, error: null }
  },
  
  reset: () => set(initialState)
}))

// Selectors for common operations
export const chatSelectors = {
  getLastMessage: (state: ChatState): Message | undefined => 
    state.messages[state.messages.length - 1],
    
  hasMessages: (state: ChatState): boolean => 
    state.messages.length > 0,
    
  getMessageByMsgId: (state: ChatState, msgId: string): Message | undefined =>
    state.messages.find(msg => msg.msgId === msgId)
}
