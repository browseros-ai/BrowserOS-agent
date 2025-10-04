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
  const { upsertMessage, setProcessing, setCurrentMode, reset } = useChatStore()
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

        // Check if this is a session completion marker
        if ((event as any).metadata?.sessionCompleted) {
          console.log('[UI] Session completed, setting isProcessing = false')
          setProcessing(false)
        }
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
        const eventType = event.payload?.eventType
        console.log('[UI] Teach mode event received, eventType:', eventType, 'full payload:', event.payload)

        // Route to teachmode store
        handleBackendEvent(event.payload)

        // IMPORTANT: Only manage chatStore.isProcessing for completion/failure
        // All other teach mode events should NOT touch chatStore.isProcessing
        if (eventType === 'execution_completed' || eventType === 'execution_failed') {
          console.log('[UI] Teach mode ended, clearing chatStore.isProcessing')
          setProcessing(false)

          // Show completion message in agent/chat modes
          upsertMessage({
            msgId: `teach_completed_${Date.now()}`,
            content: eventType === 'execution_completed'
              ? '✅ Teach mode completed'
              : '❌ Teach mode failed',
            role: 'assistant',
            ts: Date.now()
          })
        }
        // For all other teach mode events (started, thinking, etc), do nothing with chatStore.isProcessing
        // It was already set to true by SESSION_STARTED
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

        // Clear processing state when teach mode completes/fails (legacy)
        const eventType = payload.details.payload.eventType
        if (eventType === 'execution_completed' || eventType === 'execution_failed') {
          console.log('[UI] Teach mode ended (legacy), clearing isProcessing')
          setProcessing(false)

          // Show completion message in agent/chat modes (legacy)
          upsertMessage({
            msgId: `teach_completed_${Date.now()}`,
            content: eventType === 'execution_completed'
              ? '✅ Teach mode completed'
              : '❌ Teach mode failed',
            role: 'assistant',
            ts: Date.now()
          })
        }
      }
    }
  }, [upsertMessage, handleBackendEvent, setProcessing])
  
  // Handle workflow status for processing state
  const handleWorkflowStatus = useCallback((payload: any) => {
    console.log('[UI] handleWorkflowStatus called, payload:', payload)

    // IMPORTANT: NEVER clear processing state from WORKFLOW_STATUS
    // Processing state is ONLY managed by:
    // 1. SESSION_STARTED → sets true
    // 2. Session completion events (completed/failed/aborted) → sets false
    // 3. User submitting query → sets true
    //
    // WORKFLOW_STATUS is a legacy message type that we're phasing out
    // It should NOT control the processing state anymore
    console.log('[UI] ✓ Ignoring WORKFLOW_STATUS - processing state managed by session events')
    return

    // Old code kept for reference (will be removed in future):
    // if (payload?.status === 'success' || payload?.status === 'error') {
    //   setProcessing(false)
    // }
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

        setProcessing(true)

        // Set current mode for browse/chat (for message filtering)
        if (mode === 'browse' || mode === 'chat') {
          setCurrentMode(mode)
        }

        // For teach mode, clear currentMode and show message in all modes
        if (mode === 'teach') {
          setCurrentMode(null)  // Clear mode so message shows in all modes
          upsertMessage({
            msgId: `teach_running_${Date.now()}`,
            content: '⏳ Teach mode is currently running...',
            role: 'thinking',
            ts: Date.now()
          })
        }

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
  }, [setProcessing, setCurrentMode, sendRawMessage])

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
