import { useEffect, useCallback, useState, useRef } from 'react'
import { MessageType } from '@/lib/types/messaging'
import { useSidePanelPortMessaging } from '@/sidepanel/hooks'
import { useChatStore, type PubSubMessage } from '../stores/chatStore'

interface HumanInputRequest {
  requestId: string
  prompt: string
}

export function useMessageHandler() {
  const { upsertMessage, setProcessing, reset } = useChatStore()
  const { addMessageListener, removeMessageListener, sendMessage } = useSidePanelPortMessaging()
  const [humanInputRequest, setHumanInputRequest] = useState<HumanInputRequest | null>(null)
  
  const clearHumanInputRequest = useCallback(() => {
    setHumanInputRequest(null)
  }, [])

  const handleStreamUpdate = useCallback((payload: any) => {
    // Handle new architecture events (with executionId and event structure)
    if (payload?.event) {
      const event = payload.event
      
      // Handle message events
      if (event.type === 'message') {
        const message = event.payload as PubSubMessage
        
        // Filter out narration messages, it's disabled
        if (message.role === 'narration') {
          return 
        }
        
        upsertMessage(message)
      }
      
      // Handle human-input-request events
      if (event.type === 'human-input-request') {
        const request = event.payload
        setHumanInputRequest({
          requestId: request.requestId,
          prompt: request.prompt
        })
      }
    }
    // Legacy handler for old event structure (for backward compatibility during transition)
    else if (payload?.action === 'PUBSUB_EVENT') {
      // Handle message events
      if (payload.details?.type === 'message') {
        const message = payload.details.payload as PubSubMessage
        
        // Filter out narration messages
        if (message.role === 'narration') {
          return 
        }
        
        upsertMessage(message)
      }
      
      // Handle human-input-request events
      if (payload.details?.type === 'human-input-request') {
        const request = payload.details.payload
        setHumanInputRequest({
          requestId: request.requestId,
          prompt: request.prompt
        })
      }
    }
  }, [upsertMessage])
  
  // Handle workflow status for processing state
  const handleWorkflowStatus = useCallback((payload: any) => {
    // With singleton execution, we handle all workflow status messages
    if (payload?.status === 'success' || payload?.status === 'error') {
      // Execution completed (success or error)
      setProcessing(false)
    }
    // Note: We still let ChatInput set processing(true) when sending query
    // This avoids race conditions and provides immediate UI feedback
  }, [setProcessing])
  
  useEffect(() => {
    // Register listeners
    addMessageListener(MessageType.AGENT_STREAM_UPDATE, handleStreamUpdate)
    addMessageListener(MessageType.WORKFLOW_STATUS, handleWorkflowStatus)
    
    // Listen for queries forwarded from newtab
    const handleRuntimeMessage = (message: any) => {
      if (message?.type === MessageType.EXECUTE_IN_SIDEPANEL) {
        const { query, metadata } = message
        
        console.log(`[SidePanel] Received query from newtab: "${query}"`)
        
        // Execute the query through the normal flow
        sendMessage(MessageType.EXECUTE_QUERY, {
          query,
          metadata
        })
        
        // Set processing state to show UI feedback
        setProcessing(true)
      }
    }
    
    chrome.runtime.onMessage.addListener(handleRuntimeMessage)
    
    // Cleanup
    return () => {
      removeMessageListener(MessageType.AGENT_STREAM_UPDATE, handleStreamUpdate)
      removeMessageListener(MessageType.WORKFLOW_STATUS, handleWorkflowStatus)
      chrome.runtime.onMessage.removeListener(handleRuntimeMessage)
    }
  }, [addMessageListener, removeMessageListener, handleStreamUpdate, handleWorkflowStatus, sendMessage, reset, setProcessing])
  
  return {
    humanInputRequest,
    clearHumanInputRequest
  }
}
