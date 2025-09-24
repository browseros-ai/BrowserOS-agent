import { useEffect, useRef, useState, useCallback } from 'react'
import { useChatStore } from '@/sidepanel/stores/chatStore'
import { PortMessaging } from '@/lib/runtime/PortMessaging'
import { MessageType } from '@/lib/types/messaging'

/**
 * Custom hook for managing port messaging for the side panel.
 * Uses per-tab port naming for multi-execution support.
 */
export function useSidePanelPortMessaging() {
  const messagingRef = useRef<PortMessaging | null>(null)
  const [connected, setConnected] = useState<boolean>(false)
  const [executionId, setExecutionId] = useState<string | null>(null)
  const [tabId, setTabId] = useState<number | null>(null)
  const { setCurrentExecution } = useChatStore()
  const lastContextRef = useRef<{ executionId: string | null; tabId: number | null }>({
    executionId: null,
    tabId: null
  })

  // Get the global singleton instance
  if (!messagingRef.current) {
    messagingRef.current = PortMessaging.getInstance()
  }

  const applyExecutionContext = useCallback(
    (nextExecutionId: string | null | undefined, nextTabId?: number) => {
      if (typeof nextTabId === 'number') {
        setTabId((prev) => (prev === nextTabId ? prev : nextTabId))
      }

      if (nextExecutionId) {
        setExecutionId((prev) => {
          if (prev === nextExecutionId) {
            return prev
          }
          setCurrentExecution(nextExecutionId)
          return nextExecutionId
        })
      }

      if (nextExecutionId || typeof nextTabId === 'number') {
        lastContextRef.current = {
          executionId: nextExecutionId ?? lastContextRef.current.executionId,
          tabId: typeof nextTabId === 'number' ? nextTabId : lastContextRef.current.tabId
        }
      }
    },
    [setCurrentExecution]
  )

  const handleConnectionChange = useCallback((isConnected: boolean) => {
    setConnected(isConnected)
  }, [])

  const handleExecutionContext = useCallback(
    (payload: { executionId: string; tabId?: number }) => {
      console.log('[SidePanelPortMessaging] Received execution context:', payload)
      const previous = lastContextRef.current

      if (payload.executionId !== previous.executionId || payload.tabId !== previous.tabId) {
        console.log('[SidePanelPortMessaging] Switching execution context:', {
          from: { tabId: previous.tabId, executionId: previous.executionId },
          to: { tabId: payload.tabId, executionId: payload.executionId }
        })
      }

      applyExecutionContext(payload.executionId, payload.tabId)
    },
    [applyExecutionContext]
  )

  useEffect(() => {
    const messaging = messagingRef.current
    if (!messaging) return

    const portName = 'sidepanel'

    messaging.addConnectionListener(handleConnectionChange)
    messaging.addMessageListener(MessageType.EXECUTION_CONTEXT, handleExecutionContext)

    const success = messaging.isConnected() ? true : messaging.connect(portName, true)

    if (!success) {
      console.error(`[SidePanelPortMessaging] Failed to connect with port ${portName}`)
    } else {
      console.log(`[SidePanelPortMessaging] Connected successfully with port ${portName}`)
    }

    return () => {
      messaging.removeConnectionListener(handleConnectionChange)
      messaging.removeMessageListener(MessageType.EXECUTION_CONTEXT, handleExecutionContext)
    }
  }, [handleConnectionChange, handleExecutionContext])

  useEffect(() => {
    if (executionId) {
      return
    }

    let cancelled = false

    if (!chrome?.tabs?.query) {
      console.warn('[SidePanelPortMessaging] chrome.tabs.query unavailable; skipping initial context detection')
      return
    }

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (cancelled) {
        return
      }
      if (chrome.runtime.lastError) {
        console.warn(
          '[SidePanelPortMessaging] Failed to detect active tab:',
          chrome.runtime.lastError.message
        )
        return
      }

      const activeTab = tabs[0]
      if (activeTab?.id !== undefined) {
        applyExecutionContext(`tab-${activeTab.id}`, activeTab.id)
      }
    })

    return () => {
      cancelled = true
    }
  }, [executionId, applyExecutionContext])

  /**
   * Send a message to the background script
   * @param type - Message type
   * @param payload - Message payload
   * @param messageId - Optional message ID
   * @returns true if message sent successfully
   */
  const sendMessage = useCallback(
    <T,>(type: MessageType, payload: T, messageId?: string): boolean => {
      return messagingRef.current?.sendMessage(type, payload, messageId) ?? false
    },
    []
  )

  /**
   * Add a message listener for a specific message type
   * @param type - Message type to listen for
   * @param callback - Function to call when message is received
   */
  const addMessageListener = useCallback(
    <T,>(type: MessageType, callback: (payload: T, messageId?: string) => void): void => {
      messagingRef.current?.addMessageListener(type, callback)
    },
    []
  )

  /**
   * Remove a message listener
   * @param type - Message type
   * @param callback - Callback to remove
   */
  const removeMessageListener = useCallback(
    <T,>(type: MessageType, callback: (payload: T, messageId?: string) => void): void => {
      messagingRef.current?.removeMessageListener(type, callback)
    },
    []
  )

  return {
    connected,
    executionId,
    tabId,
    sendMessage,
    addMessageListener,
    removeMessageListener
  }
}
