import { useEffect, useRef, useCallback } from 'react'
import { MessageType } from '@/lib/types/messaging'
import { useSidePanelPortMessaging } from '@/sidepanel/hooks'
import { useChatStore } from '../stores/chatStore'

export function useMessageHandler() {
  const { addMessage, updateMessage, setProcessing, setError, markMessageAsExecuting, markMessageAsCompleting, setExecutingMessageRemoving } = useChatStore()
  const { addMessageListener, removeMessageListener } = useSidePanelPortMessaging()
  
  // Track streaming messages by ID for updates
  const streamingMessages = useRef<Map<string, { messageId: string, content: string }>>(new Map())
  
  // Create stable callback functions
  const handleStreamUpdate = useCallback((payload: any) => {
    const { details } = payload
    
    if (!details?.messageType) return
    
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
        setTimeout(() => setExecutingMessageRemoving(false), 400)
      }
    }
    
    switch (details.messageType) {
      case 'SystemMessage': {
        if (details.content) {
          const isExecuting = details.content.includes('executing') || details.content.includes('Executing')
          
          // Mark existing executing messages as completing
          if (!isExecuting) {
            markExecutingAsCompleting()
          }
          
          addMessage({
            role: 'system',
            content: details.content,
            metadata: isExecuting ? { isExecuting: true } : undefined
          })
          
          // If this is an executing message, mark it as executing
          if (isExecuting) {
            const lastMessage = useChatStore.getState().messages.slice(-1)[0]
            if (lastMessage) {
              markMessageAsExecuting(lastMessage.id)
            }
          }
        }
        break
      }
      
      case 'NewSegment': {
        // Mark existing executing messages as completing
        markExecutingAsCompleting()
        
        // Start a new streaming message
        const messageId = details.messageId || `stream-${Date.now()}`
        const message = {
          role: 'assistant' as const,
          content: '...'  // Placeholder while streaming
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
        
        // Add tool result as assistant message
        if (details.content) {
          addMessage({
            role: 'assistant',
            content: details.content,
            metadata: {
              toolName: details.toolName
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
          metadata: { error: true }
        })
        setError(errorMessage)
        setProcessing(false)
        break
      }
      
      case 'TaskResult': {
        // Mark existing executing messages as completing
        markExecutingAsCompleting()
        
        // Task completed
        setProcessing(false)
        if (details.content) {
          addMessage({
            role: 'system',
            content: details.content
          })
        }
        break
      }
      
      case 'CancelMessage': {
        // Mark existing executing messages as completing
        markExecutingAsCompleting()
        
        // Task cancelled
        setProcessing(false)
        if (details.content) {
          addMessage({
            role: 'system',
            content: details.content
          })
        }
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
        setTimeout(() => setExecutingMessageRemoving(false), 400)
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
  
  const handleSystemMessage = useCallback((payload: any) => {
    if (payload.content) {
      // Mark any executing messages as completing
      const state = useChatStore.getState()
      const executingMessages = state.messages.filter(msg => msg.metadata?.isExecuting && !msg.metadata?.isCompleting)
      if (executingMessages.length > 0) {
        setExecutingMessageRemoving(true)
        executingMessages.forEach(msg => {
          markMessageAsCompleting(msg.id)
        })
        // Reset the flag after animation
        setTimeout(() => setExecutingMessageRemoving(false), 400)
      }
      
      addMessage({
        role: 'system',
        content: payload.content
      })
    }
  }, [addMessage, markMessageAsCompleting, setExecutingMessageRemoving])
  
  useEffect(() => {
    // Register listeners
    addMessageListener(MessageType.AGENT_STREAM_UPDATE, handleStreamUpdate)
    addMessageListener(MessageType.WORKFLOW_STATUS, handleWorkflowStatus)
    addMessageListener(MessageType.SYSTEM, handleSystemMessage)
    
    // Cleanup
    return () => {
      removeMessageListener(MessageType.AGENT_STREAM_UPDATE, handleStreamUpdate)
      removeMessageListener(MessageType.WORKFLOW_STATUS, handleWorkflowStatus)
      removeMessageListener(MessageType.SYSTEM, handleSystemMessage)
      streamingMessages.current.clear()
    }
  }, [addMessageListener, removeMessageListener, handleStreamUpdate, handleWorkflowStatus, handleSystemMessage])
}