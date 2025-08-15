import { create } from 'zustand'
import { z } from 'zod'

// Message schema - keep it simple
export const MessageSchema = z.object({
  id: z.string(),  // Unique message ID
  role: z.enum(['user', 'assistant', 'system']),  // Message sender role
  content: z.string(),  // Message content
  timestamp: z.date(),  // When message was created
  metadata: z.object({
    toolName: z.string().optional(),  // Tool name if this is a tool result
    error: z.boolean().optional(),  // Flag for error messages
    isExecuting: z.boolean().optional(),  // Flag for executing messages
    isCompleting: z.boolean().optional(),  // Flag for messages that are finishing execution
    isStartup: z.boolean().optional(),  // Flag for initial startup status lines
    kind: z.enum(['stream', 'execution', 'tool-result', 'system', 'error', 'cancel', 'task-result']).optional(),  // Normalized message kind
    streamId: z.string().optional(),  // Streaming correlation id
    category: z.string().optional(),  // Optional category from system messages
    success: z.boolean().optional(),  // Success flag for tool/task results
    msgId: z.string().optional(),  // Message ID for pub-sub system
    timestamp: z.number().optional()  // Timestamp from pub-sub system
  }).optional()  // Optional metadata
})

export type Message = z.infer<typeof MessageSchema>

// Store state schema
const ChatStateSchema = z.object({
  messages: z.array(MessageSchema),  // All chat messages
  isProcessing: z.boolean(),  // Is agent currently processing
  error: z.string().nullable(),  // Current error message if any
  executingMessageRemoving: z.boolean()  // Flag when executing message is being removed
})

type ChatState = z.infer<typeof ChatStateSchema>

// Store actions
interface ChatActions {
  // Message operations
  addMessage: (message: Omit<Message, 'id' | 'timestamp'>) => void
  updateMessage: (id: string, content: string) => void
  clearMessages: () => void
  
  // Executing message operations
  markMessageAsExecuting: (id: string) => void
  markMessageAsCompleting: (id: string) => void
  removeExecutingMessage: (id: string) => void
  setExecutingMessageRemoving: (removing: boolean) => void
  
  // Processing state
  setProcessing: (processing: boolean) => void
  
  // Error handling
  setError: (error: string | null) => void
  
  // Reset everything
  reset: () => void
}

// Initial state
const initialState: ChatState = {
  messages: [],
  isProcessing: false,
  error: null,
  executingMessageRemoving: false
}

// Create the store
export const useChatStore = create<ChatState & ChatActions>((set) => ({
  // State
  ...initialState,
  
  // Actions
  addMessage: (message) => {
    const newMessage: Message = {
      ...message,
      id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      timestamp: new Date()
    }
    
    set((state) => ({
      messages: [...state.messages, newMessage],
      error: null  // Clear error when new message is added
    }))
  },
  
  updateMessage: (id, content) => {
    set((state) => ({
      messages: state.messages.map(msg =>
        msg.id === id ? { ...msg, content } : msg
      )
    }))
  },
  
  clearMessages: () => set({ messages: [] }),
  
  // Executing message operations
  markMessageAsExecuting: (id) => {
    set((state) => ({
      messages: state.messages.map(msg =>
        msg.id === id ? { 
          ...msg, 
          metadata: { 
            ...msg.metadata, 
            isExecuting: true,
            isCompleting: false
          } 
        } : msg
      )
    }))
  },
  
  markMessageAsCompleting: (id) => {
    set((state) => ({
      messages: state.messages.map(msg =>
        msg.id === id ? { 
          ...msg, 
          metadata: { 
            ...msg.metadata, 
            isExecuting: false,
            isCompleting: true
          } 
        } : msg
      )
    }))
  },
  
  removeExecutingMessage: (id) => {
    set((state) => ({
      messages: state.messages.filter(msg => msg.id !== id)
    }))
  },
  
  setExecutingMessageRemoving: (removing) => set({ executingMessageRemoving: removing }),
  
  setProcessing: (processing) => set({ isProcessing: processing }),
  
  setError: (error) => set({ error }),
  
  reset: () => set(initialState)
}))

// Selectors for common operations
export const chatSelectors = {
  getLastMessage: (state: ChatState): Message | undefined => 
    state.messages[state.messages.length - 1],
    
  hasMessages: (state: ChatState): boolean => 
    state.messages.length > 0,
    
  getMessageById: (state: ChatState, id: string): Message | undefined =>
    state.messages.find(msg => msg.id === id)
}