import { useEffect, useRef } from 'react'
import { MessageType } from '@/lib/types/messaging'
import { useSidePanelPortMessaging } from '@/sidepanel/hooks'
import { useChatStore } from '../stores/chatStore'

export function useMessageHandler() {
  const { addMessage, updateMessage, setProcessing, setError } = useChatStore()
  const { addMessageListener, removeMessageListener } = useSidePanelPortMessaging()
  
  // Track streaming messages by ID for updates
  const streamingMessages = useRef<Map<string, { messageId: string, content: string }>>(new Map())
  
  useEffect(() => {
    // Handle agent stream updates
    const handleStreamUpdate = (payload: any) => {
      const { details } = payload
      
      if (!details?.messageType) return
      
      switch (details.messageType) {
        case 'SystemMessage': {
          if (details.content) {
            addMessage({
              role: 'system',
              content: details.content
            })
          }
          break
        }
        
        case 'NewSegment': {
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
    }
    
    // Handle workflow status updates
    const handleWorkflowStatus = (payload: any) => {
      if (payload.status === 'completed' || payload.status === 'failed' || payload.cancelled) {
        setProcessing(false)
        
        if (payload.error && !payload.cancelled) {
          setError(payload.error)
          addMessage({
            role: 'system',
            content: payload.error,
            metadata: { error: true }
          })
        }
      }
    }
    
    // Register listeners
    addMessageListener(MessageType.AGENT_STREAM_UPDATE, handleStreamUpdate)
    addMessageListener(MessageType.WORKFLOW_STATUS, handleWorkflowStatus)
    
    // Cleanup
    return () => {
      removeMessageListener(MessageType.AGENT_STREAM_UPDATE, handleStreamUpdate)
      removeMessageListener(MessageType.WORKFLOW_STATUS, handleWorkflowStatus)
      streamingMessages.current.clear()
    }
  }, [addMessage, updateMessage, setProcessing, setError, addMessageListener, removeMessageListener])
}