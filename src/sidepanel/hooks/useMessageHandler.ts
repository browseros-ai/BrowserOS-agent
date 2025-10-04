import { useEffect, useCallback, useState, useRef } from 'react'
import { MessageType } from '@/lib/types/messaging'
import { useSidePanelPortMessaging } from '@/sidepanel/hooks'
import { useChatStore, type PubSubMessage } from '../stores/chatStore'
import { useTeachModeStore } from '../teachmode/teachmode.store'

interface HumanInputRequest {
  requestId: string
  prompt: string
}

export function useMessageHandler() {
  const { upsertMessage, setProcessing, reset } = useChatStore()
  const { addMessageListener, removeMessageListener, sendMessage, sendRawMessage } = useSidePanelPortMessaging()
  const [humanInputRequest, setHumanInputRequest] = useState<HumanInputRequest | null>(null)
  const handleBackendEvent = useTeachModeStore(state => state.handleBackendEvent)
  
  const clearHumanInputRequest = useCallback(() => {
    setHumanInputRequest(null)
  }, [])

  const handleStreamUpdate = useCallback((payload: any) => {
    console.log('[UI] handleStreamUpdate called, payload:', payload)

    // Handle new architecture events (with executionId and event structure)
    if (payload?.event) {
      const event = payload.event
      console.log('[UI] Event type:', event.type, 'payload:', event.payload)

      // Handle message events
      if (event.type === 'message') {
        const message = event.payload as PubSubMessage
        console.log('[UI] Upserting message, role:', message.role, 'content:', message.content?.substring(0, 40))
        upsertMessage(message)
        console.log('[UI] Message upserted successfully')
      }
      
      // Handle human-input-request events
      if (event.type === 'human-input-request') {
        const request = event.payload
        setHumanInputRequest({
          requestId: request.requestId,
          prompt: request.prompt
        })
      }

      // Handle teach-mode-event
      if (event.type === 'teach-mode-event') {
        handleBackendEvent(event.payload)
      }
    }
    // Legacy handler for old event structure (for backward compatibility during transition)
    else if (payload?.action === 'PUBSUB_EVENT') {
      // Handle message events
      if (payload.details?.type === 'message') {
        const message = payload.details.payload as PubSubMessage
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

      // Handle teach-mode-event (legacy)
      if (payload.details?.type === 'teach-mode-event') {
        handleBackendEvent(payload.details.payload)
      }
    }
  }, [upsertMessage, handleBackendEvent])
  
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
  
  // Set up runtime message listener for execution starting notification
  useEffect(() => {
    const handleRuntimeMessage = (message: any) => {
      // Handle execution starting from newtab
      if (message?.type === MessageType.EXECUTION_STARTING) {
        console.log(`[SidePanel] Execution starting from ${message.source}`)
        setProcessing(true)
      }

      // Handle new session start
      if (message?.type === 'SESSION_STARTED') {
        const { sessionId, mode } = message.payload
        console.log('[UI] SESSION_STARTED received:', sessionId, mode, 'at', Date.now())

        // Tell PortManager to subscribe to this session
        console.log('[UI] Sending SUBSCRIBE_SESSION:', sessionId)
        sendRawMessage({
          type: 'SUBSCRIBE_SESSION',
          sessionId
        })
      }

      // Handle panel close signal
      if (message?.type === MessageType.CLOSE_PANEL) {
        window.close()
      }
    }

    chrome.runtime.onMessage.addListener(handleRuntimeMessage)

    return () => {
      chrome.runtime.onMessage.removeListener(handleRuntimeMessage)
    }
  }, [setProcessing, sendRawMessage])  // Added sendRawMessage to dependencies

  // Set up port message listeners
  useEffect(() => {
    // Register listeners
    addMessageListener(MessageType.AGENT_STREAM_UPDATE, handleStreamUpdate)
    addMessageListener(MessageType.WORKFLOW_STATUS, handleWorkflowStatus)

    // Cleanup
    return () => {
      removeMessageListener(MessageType.AGENT_STREAM_UPDATE, handleStreamUpdate)
      removeMessageListener(MessageType.WORKFLOW_STATUS, handleWorkflowStatus)
    }
  }, [addMessageListener, removeMessageListener, handleStreamUpdate, handleWorkflowStatus])
  
  return {
    humanInputRequest,
    clearHumanInputRequest
  }
}
