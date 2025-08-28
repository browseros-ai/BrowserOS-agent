import { useEffect, useCallback, useState } from 'react'
import { MessageType } from '@/lib/types/messaging'
import { useSidePanelPortMessaging } from '@/sidepanel/hooks'
import { useChatStore, type PubSubMessage } from '../stores/chatStore'

interface HumanInputRequest {
  requestId: string
  prompt: string
}

export function useMessageHandler() {
  const { upsertMessage, setProcessing } = useChatStore()
  const { addMessageListener, removeMessageListener } = useSidePanelPortMessaging()
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
        
        // Check for completion or error messages from agents
        if (message.role === 'error') {
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
        
        if (message.role === 'error') {
          setProcessing(false)
        }
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
  }, [upsertMessage, setProcessing])
  
  useEffect(() => {
    // Register listener for PubSub events only
    addMessageListener(MessageType.AGENT_STREAM_UPDATE, handleStreamUpdate)
    
    // Cleanup
    return () => {
      removeMessageListener(MessageType.AGENT_STREAM_UPDATE, handleStreamUpdate)
    }
  }, [addMessageListener, removeMessageListener, handleStreamUpdate])
  
  return {
    humanInputRequest,
    clearHumanInputRequest
  }
}
