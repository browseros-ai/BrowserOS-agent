import { useEffect, useRef, useState, useCallback } from 'react'
import { PortMessaging } from '@/lib/runtime/PortMessaging'
import { MessageType } from '@/lib/types/messaging'
import { getExecutionId } from '@/lib/utils/executionUtils'

/**
 * Custom hook for managing port messaging specifically for the side panel.
 * Uses tab-based executionId for consistent execution context.
 */
// TODO: maybe use zustand here to manage state
export function useSidePanelPortMessaging() {
  const messagingRef = useRef<PortMessaging | null>(null)
  const [connected, setConnected] = useState<boolean>(false)
  const [triggeredTabId, setTriggeredTabId] = useState<number | null>(null)
  const [executionId, setExecutionId] = useState<string | null>(null)
  const [isReconnecting, setIsReconnecting] = useState<boolean>(false)
  
  // Get the global singleton instance
  if (!messagingRef.current) {
    messagingRef.current = PortMessaging.getInstance()
  }

  useEffect(() => {
    const messaging = messagingRef.current
    if (!messaging) return

    // Initialize connection with tab-based executionId
    const initializeConnection = async () => {
      try {
        // Get the current active tab
        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true })
        if (activeTab?.id) {
          setTriggeredTabId(activeTab.id)
          
          // Generate execution ID from tab ID
          const tabExecutionId = await getExecutionId(activeTab.id)
          setExecutionId(tabExecutionId)
          
          // Set up connection listener
          const handleConnectionChange = (isConnected: boolean) => {
            setConnected(isConnected)
          }

          messaging.addConnectionListener(handleConnectionChange)

          // Connect to background script using executionId (which already contains tabId)
          const dynamicPortName = `sidepanel:${tabExecutionId}`
          const success = messaging.connect(dynamicPortName, true)
          
          if (!success) {
            console.error(`[SidePanelPortMessaging] Failed to connect with executionId: ${tabExecutionId}`)
          } else {
            console.log(`[SidePanelPortMessaging] Connected with executionId: ${tabExecutionId}`)
          }
        } else {
          console.error('[SidePanelPortMessaging] Could not get active tab ID')
        }
      } catch (error) {
        console.error('[SidePanelPortMessaging] Error getting tab info:', error)
      }
    }

    initializeConnection()

    // Cleanup on unmount: remove listener but keep the global connection alive
    return () => {
      const messaging = messagingRef.current
      if (messaging) {
        messaging.removeConnectionListener((isConnected: boolean) => {
          setConnected(isConnected)
        })
      }
    }
  }, [])

  /**
   * Send a message to the background script
   * @param type - Message type
   * @param payload - Message payload
   * @param messageId - Optional message ID
   * @returns true if message sent successfully
   */
  const sendMessage = useCallback(<T>(type: MessageType, payload: T, messageId?: string): boolean => {
    return messagingRef.current?.sendMessage(type, payload, messageId) ?? false
  }, [])

  /**
   * Add a message listener for a specific message type
   * @param type - Message type to listen for
   * @param callback - Function to call when message is received
   */
  const addMessageListener = useCallback(<T>(
    type: MessageType,
    callback: (payload: T, messageId?: string) => void
  ): void => {
    messagingRef.current?.addMessageListener(type, callback)
  }, [])

  /**
   * Remove a message listener
   * @param type - Message type
   * @param callback - Callback to remove
   */
  const removeMessageListener = useCallback(<T>(
    type: MessageType,
    callback: (payload: T, messageId?: string) => void
  ): void => {
    messagingRef.current?.removeMessageListener(type, callback)
  }, [])
  
  /**
   * Reconnect with a new executionId (used when switching context from NewTab)
   * @param newExecutionId - The new execution ID to connect with
   */
  const reconnect = useCallback(async (newExecutionId: string) => {
    const messaging = messagingRef.current
    if (!messaging) return
    
    console.log(`[SidePanelPortMessaging] Reconnecting with new executionId: ${newExecutionId}`)
    setIsReconnecting(true)
    
    try {
      // Disconnect current connection if exists
      messaging.disconnect()
      
      // Update state with new executionId
      setExecutionId(newExecutionId)
      
      // Connect with new executionId
      const dynamicPortName = `sidepanel:${newExecutionId}`
      const success = messaging.connect(dynamicPortName, true)
      
      if (!success) {
        console.error(`[SidePanelPortMessaging] Failed to reconnect with executionId: ${newExecutionId}`)
      } else {
        console.log(`[SidePanelPortMessaging] Successfully reconnected with executionId: ${newExecutionId}`)
      }
    } finally {
      setIsReconnecting(false)
    }
  }, [])

  return {
    connected,
    executionId,  // Expose executionId for components to use
    tabId: triggeredTabId,  // Expose tabId for components to know which tab they're connected to
    sendMessage,
    addMessageListener,
    removeMessageListener,
    reconnect,  // Expose reconnect function
    isReconnecting  // Expose reconnecting state
  }
} 
