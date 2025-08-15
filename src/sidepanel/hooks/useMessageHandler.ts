import { useEffect, useCallback } from 'react'
import { MessageType } from '@/lib/types/messaging'
import { useSidePanelPortMessaging } from '@/sidepanel/hooks'
import { useChatStore, type PubSubMessage } from '../stores/chatStore'

export function useMessageHandler() {
  const { upsertMessage, setProcessing } = useChatStore()
  const { addMessageListener, removeMessageListener } = useSidePanelPortMessaging()

  const handleStreamUpdate = useCallback((payload: any) => {
    // Check if this is a PubSub event
    if (payload?.action === 'PUBSUB_EVENT') {
      // Handle message events
      if (payload.details?.type === 'message') {
        const message = payload.details.payload as PubSubMessage
        
        // Filter out narration messages, it's disbled
        if (message.role === 'narration') {
          return 
        }
        
        upsertMessage(message)
        
        // Check for completion or error messages from agents
        if (message.role === 'error') {
          setProcessing(false)
        }
      }
      
      // Handle execution-status events
      if (payload.details?.type === 'execution-status') {
        const status = payload.details.payload.status
        
        // Set processing based on status
        if (status === 'running') {
          setProcessing(true)
        } else if (status === 'done' || status === 'cancelled' || status === 'error') {
          setProcessing(false)
        }
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
}
