import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { PortMessaging, PortName } from '@/lib/runtime/PortMessaging'
import { MessageType } from '@/lib/types/messaging'

/**
 * Custom hook for managing port messaging specifically for the side panel.
 * Uses dynamic port naming with executionId to support multiple concurrent executions.
 */
export function useSidePanelPortMessaging() {
  const messagingRef = useRef<PortMessaging | null>(null)
  const [connected, setConnected] = useState<boolean>(false)
  
  // Generate a unique executionId for this sidepanel instance
  // Using useMemo ensures it's stable across renders but unique per mount
  const executionId = useMemo(() => {
    // Check if we already have an executionId in sessionStorage (for reconnection)
    const stored = sessionStorage.getItem('executionId')
    if (stored) {
      return stored
    }
    
    // Generate new executionId
    const newId = `exec_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
    sessionStorage.setItem('executionId', newId)
    return newId
  }, [])
  
  // Get the global singleton instance
  if (!messagingRef.current) {
    messagingRef.current = PortMessaging.getInstance()
  }

  useEffect(() => {
    const messaging = messagingRef.current
    if (!messaging) return

    // Set up connection listener
    const handleConnectionChange = (isConnected: boolean) => {
      setConnected(isConnected)
    }

    messaging.addConnectionListener(handleConnectionChange)

    // Connect to background script using dynamic port name with executionId
    const dynamicPortName = `sidepanel:${executionId}`
    const success = messaging.connect(dynamicPortName, true)
    
    if (!success) {
      console.error(`[SidePanelPortMessaging] Failed to connect with executionId: ${executionId}`)
    } else {
      console.log(`[SidePanelPortMessaging] Connected with executionId: ${executionId}`)
    }

    // Cleanup on unmount: remove listener but keep the global connection alive
    return () => {
      messaging.removeConnectionListener(handleConnectionChange)
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

  return {
    connected,
    executionId,  // Expose executionId for components to use
    sendMessage,
    addMessageListener,
    removeMessageListener
  }
} 