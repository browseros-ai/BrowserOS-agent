import { useEffect, useRef, useCallback } from 'react'
import { z } from 'zod'
import { MessageType } from '@/lib/types/messaging'
import { useSidePanelPortMessaging } from '@/sidepanel/hooks'
import { useChatStore } from '../stores/chatStore'

export function useMessageHandler() {
  const { addMessage, updateMessage, setProcessing, setError, markMessageAsExecuting, markMessageAsCompleting, setExecutingMessageRemoving } = useChatStore()
  const { addMessageListener, removeMessageListener } = useSidePanelPortMessaging()
  
  // Track streaming messages by ID for updates
  const streamingMessages = useRef<Map<string, { messageId: string, content: string }>>(new Map())
  // Suppress assistant streaming while tools are running
  const suppressStreamingRef = useRef<boolean>(false)
  
  // Zod schema to validate incoming UI message details
  const UIMessageTypeSchema = z.enum([
    'SystemMessage',
    'ThinkingMessage',
    'NewSegment',
    'StreamingChunk',
    'FinalizeSegment',
    'ToolStart',
    'ToolStream',
    'ToolEnd',
    'ToolResult',
    'ErrorMessage',
    'CancelMessage',
    'TaskResult'
  ])

  const UIMessageSchema = z.object({
    messageType: UIMessageTypeSchema,
    messageId: z.string().optional(),
    segmentId: z.number().optional(),
    content: z.string().optional(),
    toolName: z.string().optional(),
    toolArgs: z.object({
      description: z.string().optional(),
      icon: z.string().optional(),
      args: z.record(z.unknown()).optional()
    }).optional(),
    toolResult: z.string().optional(),
    success: z.boolean().optional(),
    error: z.string().optional(),
    data: z.record(z.unknown()).optional()
  })

  // Create stable callback functions
  const handleStreamUpdate = useCallback((payload: any) => {
    const parsed = UIMessageSchema.safeParse(payload?.details)
    if (!parsed.success) return
    const details = parsed.data
    
    // Mark any existing executing messages as completing when new messages are added
    const markExecutingAsCompleting = () => {
      const state = useChatStore.getState()
      const executingMessages = state.messages.filter(msg => msg.metadata?.isExecuting && !msg.metadata?.isCompleting)
      if (executingMessages.length > 0) {
        setExecutingMessageRemoving(true)
        executingMessages.forEach(msg => {
          markMessageAsCompleting(msg.id)
        })
        // Reset the flag after animation
        setTimeout(() => setExecutingMessageRemoving(false), 600)
      }
    }
    
    switch (details.messageType) {
      case 'SystemMessage': {
        const category = typeof details.data?.category === 'string' ? details.data?.category as string : undefined
        const content = details.content || ''

        // Task Manager (TODO table) detection and per-prompt handling
        const isTodoTable = content.includes('| # | Status | Task |')
        if (isTodoTable) {
          const currentMessages = useChatStore.getState().messages
          const lastUserIndex = [...currentMessages].map(m => m.role).lastIndexOf('user')
          const lastTodoIndex = [...currentMessages].map(m => m.content.includes('| # | Status | Task |')).lastIndexOf(true)

          if (lastTodoIndex !== -1 && lastTodoIndex > lastUserIndex) {
            // Update the existing Task Manager for the current prompt
            const lastTodoMessage = currentMessages[lastTodoIndex]
            updateMessage(lastTodoMessage.id, content)
          } else {
            // Create a new Task Manager for this prompt
            addMessage({
              role: 'system',
              content,
              metadata: { kind: 'system' as const }
            })
          }
          break
        }

        // Regular system message
        addMessage({
          role: 'system',
          content,
          metadata: { kind: 'system' as const, isStartup: category === 'startup', category }
        })
        break
      }

      case 'ToolStart': {
        // Mark existing executing messages as completing
        markExecutingAsCompleting()
        suppressStreamingRef.current = true
        
        // Add executing message for tool start
        const description = details.toolArgs?.description || details.toolName || 'Executing tool'
        addMessage({
          role: 'system',
          content: description,
          metadata: { kind: 'execution' as const, isExecuting: true, toolName: details.toolName }
        })
        // Mark this message as executing
        {
          const lastMessage = useChatStore.getState().messages.slice(-1)[0]
          if (lastMessage) markMessageAsExecuting(lastMessage.id)
        }
        break
      }

      case 'ToolEnd': {
        // Mark existing executing messages as completing - they will be removed
        markExecutingAsCompleting()
        suppressStreamingRef.current = false
        break
      }

      case 'ThinkingMessage': {
        // Mark existing executing messages as completing
        markExecutingAsCompleting()
        
        // Add thinking message
        addMessage({
          role: 'system',
          content: details.content || 'Working…',
          metadata: { kind: 'execution' as const, isExecuting: true }
        })
        // Mark this message as executing
        {
          const lastMessage = useChatStore.getState().messages.slice(-1)[0]
          if (lastMessage) markMessageAsExecuting(lastMessage.id)
        }
        break
      }
      
      case 'NewSegment': {
        // Optionally suppress assistant stream segments during tool execution
        if (suppressStreamingRef.current) {
          break
        }
        // Mark existing executing messages as completing
        markExecutingAsCompleting()
        
        // Start a new streaming message
        const messageId = details.messageId || `stream-${Date.now()}`
        const message = {
          role: 'assistant' as const,
          content: '',  // Start with empty content
          metadata: { kind: 'stream' as const, streamId: messageId }
        }
        
        addMessage(message)
        
        // Track this streaming message
        const lastMessage = useChatStore.getState().messages.slice(-1)[0]
        if (lastMessage) {
          streamingMessages.current.set(messageId, {
            messageId: lastMessage.id,
            content: ''
          })
        }
        break
      }
      
      case 'StreamingChunk': {
        if (suppressStreamingRef.current) {
          break
        }
        // Update streaming message
        if (details.messageId && details.content) {
          const streaming = streamingMessages.current.get(details.messageId)
          if (streaming) {
            streaming.content += details.content
            updateMessage(streaming.messageId, streaming.content)
          }
        }
        break
      }
      
      case 'FinalizeSegment': {
        if (suppressStreamingRef.current) {
          // Clean up any tracked entry without rendering
          if (details.messageId) streamingMessages.current.delete(details.messageId)
          break
        }
        // Complete the streaming message
        if (details.messageId) {
          const streaming = streamingMessages.current.get(details.messageId)
          if (streaming) {
            const finalContent = details.content || streaming.content
            if (finalContent) {
              updateMessage(streaming.messageId, finalContent)
            }
            streamingMessages.current.delete(details.messageId)
          }
        }
        break
      }
      
      case 'ToolResult': {
        // Mark existing executing messages as completing
        markExecutingAsCompleting()
        
        // Filter out TODO-related messages that shouldn't be shown to the user
        if (details.content && (
          details.content.includes('Completed TODO:') ||
          details.content.includes('Skipped TODO:') ||
          details.content.includes('Went back to TODO:') ||
          details.content.includes('Added') && details.content.includes('TODOs') ||
          details.content.includes('Replaced all TODOs')
        )) {
          // Don't add these messages - they're internal status updates
          break
        }
        
        // Add tool result as assistant message
        if (details.content) {
          addMessage({
            role: 'assistant',
            content: details.content,
            metadata: {
              kind: 'tool-result' as const,
              toolName: details.toolName,
              success: typeof details.success === 'boolean' ? details.success : undefined
            }
          })
        }
        break
      }
      
      case 'ErrorMessage': {
        // Mark existing executing messages as completing
        markExecutingAsCompleting()
        
        // Handle error
        const errorMessage = details.error || details.content || 'An error occurred'
        addMessage({
          role: 'system',
          content: errorMessage,
          metadata: { kind: 'error' as const, error: true }
        })
        setError(errorMessage)
        setProcessing(false)
        break
      }
      
      case 'TaskResult': {
        // Mark existing executing messages as completing
        markExecutingAsCompleting()
        suppressStreamingRef.current = false
        
        // Task completed
        setProcessing(false)
        addMessage({
          role: 'system',
          content: details.content || '',
          metadata: { kind: 'task-result' as const, success: typeof details.success === 'boolean' ? details.success : undefined }
        })
        break
      }
      
      case 'CancelMessage': {
        // Mark existing executing messages as completing
        markExecutingAsCompleting()
        suppressStreamingRef.current = false
        
        // Task cancelled
        setProcessing(false)
        addMessage({
          role: 'system',
          content: details.content || 'Task cancelled',
          metadata: { kind: 'cancel' as const }
        })
        break
      }
      
      // Skip other message types for now (ThinkingMessage, DebugMessage, etc.)
      // We can add them later if needed
    }
  }, [addMessage, updateMessage, setProcessing, setError, markMessageAsExecuting, markMessageAsCompleting, setExecutingMessageRemoving])
  
        // Handle workflow status updates
  const handleWorkflowStatus = useCallback((payload: any) => {
    if (payload.status === 'completed' || payload.status === 'failed' || payload.cancelled) {
      setProcessing(false)
      
      // Mark any executing messages as completing
      const state = useChatStore.getState()
      const executingMessages = state.messages.filter(msg => msg.metadata?.isExecuting && !msg.metadata?.isCompleting)
      if (executingMessages.length > 0) {
        setExecutingMessageRemoving(true)
        executingMessages.forEach(msg => {
          markMessageAsCompleting(msg.id)
        })
        // Reset the flag after animation
        setTimeout(() => setExecutingMessageRemoving(false), 600)
      }
      
      if (payload.error && !payload.cancelled) {
        setError(payload.error)
        addMessage({
          role: 'system',
          content: payload.error,
          metadata: { error: true }
        })
      }
    }
  }, [addMessage, setProcessing, setError, markMessageAsCompleting, setExecutingMessageRemoving])
  
  useEffect(() => {
    // Register listeners
    addMessageListener(MessageType.AGENT_STREAM_UPDATE, handleStreamUpdate)
    addMessageListener(MessageType.WORKFLOW_STATUS, handleWorkflowStatus)
    
    // Cleanup
    return () => {
      removeMessageListener(MessageType.AGENT_STREAM_UPDATE, handleStreamUpdate)
      removeMessageListener(MessageType.WORKFLOW_STATUS, handleWorkflowStatus)
      streamingMessages.current.clear()
    }
  }, [addMessageListener, removeMessageListener, handleStreamUpdate, handleWorkflowStatus])
}