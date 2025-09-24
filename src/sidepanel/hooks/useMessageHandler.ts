import { useEffect, useCallback, useState, useRef } from 'react'
import { MessageType } from '@/lib/types/messaging'
import { useSidePanelPortMessaging } from '@/sidepanel/hooks'
import { useChatStore, type PubSubMessage } from '../stores/chatStore'

interface HumanInputRequest {
  requestId: string
  prompt: string
}

const resolveExecutionId = (candidate: unknown, fallback: string | null): string | null => {
  if (typeof candidate === 'string') {
    const trimmed = candidate.trim()
    if (trimmed.length > 0) {
      return trimmed
    }
  }
  return fallback
}

export function useMessageHandler() {
  const { upsertMessage, setProcessing, setCurrentExecution } = useChatStore()
  const { addMessageListener, removeMessageListener, sendMessage, executionId } = useSidePanelPortMessaging()
  const [humanInputRequest, setHumanInputRequest] = useState<HumanInputRequest | null>(null)

  // Use a ref to always have the latest executionId without causing re-renders
  const executionIdRef = useRef(executionId)
  useEffect(() => {
    executionIdRef.current = executionId
  }, [executionId])
  
  const clearHumanInputRequest = useCallback(() => {
    setHumanInputRequest(null)
  }, [])

  const handleStreamUpdate = useCallback((payload: any) => {
    const currentExecutionId = executionIdRef.current
    const targetExecutionId = resolveExecutionId(payload?.executionId, currentExecutionId)

    if (!targetExecutionId) {
      console.log('[MessageHandler] No execution context available for stream update, skipping')
      return
    }

    if (payload?.executionId && payload.executionId !== currentExecutionId) {
      console.log(
        `[MessageHandler] Routing event for execution ${payload.executionId} while current context is ${currentExecutionId ?? 'none'}`
      )
    }

    if (payload?.event) {
      const event = payload.event

      if (event.type === 'message') {
        const message = event.payload as PubSubMessage

        if (message.role === 'narration') {
          return
        }

        console.log(`[MessageHandler] Upserting message for execution ${targetExecutionId}:`, message.msgId, message.role)
        upsertMessage(targetExecutionId, message)
      }

      if (event.type === 'human-input-request' && targetExecutionId === executionIdRef.current) {
        const request = event.payload
        setHumanInputRequest({
          requestId: request.requestId,
          prompt: request.prompt
        })
      }
    } else if (payload?.action === 'PUBSUB_EVENT') {
      if (payload.details?.type === 'message') {
        const message = payload.details.payload as PubSubMessage

        if (message.role === 'narration') {
          return
        }

        console.log(`[MessageHandler] Upserting message for execution ${targetExecutionId}:`, message.msgId, message.role)
        upsertMessage(targetExecutionId, message)
      }

      if (
        payload.details?.type === 'human-input-request' &&
        targetExecutionId === executionIdRef.current
      ) {
        const request = payload.details.payload
        setHumanInputRequest({
          requestId: request.requestId,
          prompt: request.prompt
        })
      }
    }
  }, [upsertMessage])  // Remove executionId from deps, use ref instead
  // Handle workflow status for processing state
  const handleWorkflowStatus = useCallback((payload: any) => {
    const currentExecutionId = executionIdRef.current
    const targetExecutionId = resolveExecutionId(payload?.executionId, currentExecutionId)

    if (!targetExecutionId) {
      return
    }

    if (payload?.status === 'success' || payload?.status === 'error') {
      setProcessing(targetExecutionId, false)
    }
    // Note: We still let ChatInput set processing(true) when sending query
    // This avoids race conditions and provides immediate UI feedback
  }, [setProcessing])  // Remove executionId from deps, use ref instead
  // Track current execution ID in store
  useEffect(() => {
    if (executionId) {
      setCurrentExecution(executionId)
    }
  }, [executionId, setCurrentExecution])

  // Set up runtime message listener for execution starting notification
  useEffect(() => {
    const handleRuntimeMessage = (message: any) => {
      // Handle execution starting from newtab
      if (message?.type === MessageType.EXECUTION_STARTING) {
        const messageExecutionId = message.executionId
        const currentExecutionId = executionIdRef.current  // Use ref for latest value
        const targetExecutionId = resolveExecutionId(messageExecutionId, currentExecutionId)
        console.log(`[SidePanel] Execution starting from ${message.source} (executionId: ${messageExecutionId ?? 'unknown'})`)

        if (targetExecutionId) {
          setProcessing(targetExecutionId, true)
        }
      }
    }

    chrome.runtime.onMessage.addListener(handleRuntimeMessage)

    return () => {
      chrome.runtime.onMessage.removeListener(handleRuntimeMessage)
    }
  }, [setProcessing])  // Only depend on setProcessing, use ref for executionId

  // Set up port message listeners - re-register when executionId changes
  useEffect(() => {
    // Register listeners
    console.log(`[MessageHandler] Setting up listeners for executionId: ${executionId}`)
    addMessageListener(MessageType.AGENT_STREAM_UPDATE, handleStreamUpdate)
    addMessageListener(MessageType.WORKFLOW_STATUS, handleWorkflowStatus)

    // Cleanup - CRITICAL: Remove listeners when executionId changes
    return () => {
      console.log(`[MessageHandler] Cleaning up listeners for executionId: ${executionId}`)
      removeMessageListener(MessageType.AGENT_STREAM_UPDATE, handleStreamUpdate)
      removeMessageListener(MessageType.WORKFLOW_STATUS, handleWorkflowStatus)
    }
  }, [addMessageListener, removeMessageListener, handleStreamUpdate, handleWorkflowStatus])  // Removed executionId - handlers use ref instead
  
  return {
    humanInputRequest,
    clearHumanInputRequest
  }
}



