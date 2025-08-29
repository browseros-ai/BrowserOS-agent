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
  const { addMessageListener, removeMessageListener, executionId, sendMessage } = useSidePanelPortMessaging()
  const [humanInputRequest, setHumanInputRequest] = useState<HumanInputRequest | null>(null)
  const reconnectCallbackRef = useRef<((executionId: string) => void) | null>(null)
  
  // Keep executionId in a ref to always have the current value
  const executionIdRef = useRef<string | null>(executionId)
  useEffect(() => {
    executionIdRef.current = executionId
  }, [executionId])
  
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
    // Check if this is for our execution using ref for current value
    if (payload?.executionId && payload.executionId !== executionIdRef.current) {
      return // Ignore messages for other executions
    }
    
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
    
    // Listen for context switch messages from background
    const handleRuntimeMessage = (message: any) => {
      if (message?.type === MessageType.SWITCH_EXECUTION_CONTEXT) {
        const { executionId: newExecutionId, tabId, cancelExisting } = message.payload
        
        console.log(`[SidePanel] Received SWITCH_EXECUTION_CONTEXT: ${newExecutionId}, current: ${executionIdRef.current}`)
        
        // Only switch if it's a different execution (use ref for current value)
        if (newExecutionId !== executionIdRef.current) {
          // If we should cancel and reset existing
          if (cancelExisting) {
            // Cancel any existing task
            sendMessage(MessageType.RESET_CONVERSATION, { 
              reason: 'New task started from NewTab',
              source: 'sidepanel'
            })
            
            setProcessing(false)
            reset()
          }
          
          // Trigger reconnection with new executionId
          if (reconnectCallbackRef.current) {
            reconnectCallbackRef.current(newExecutionId)
          }
        } else {
          console.log(`[SidePanel] Same executionId, no need to switch`)
        }
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
  
  // Set the reconnect callback that will be triggered on context switch
  const setReconnectCallback = useCallback((callback: (executionId: string) => void) => {
    reconnectCallbackRef.current = callback
  }, [])
  
  return {
    humanInputRequest,
    clearHumanInputRequest,
    setReconnectCallback
  }
}
