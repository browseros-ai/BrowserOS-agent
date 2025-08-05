import { useEffect, useRef, useState } from 'react'
import { PortMessaging, PortName } from '@/lib/runtime/PortMessaging'
import { MessageType } from '@/lib/types/messaging'

/**
 * Custom hook for managing port messaging specifically for the side panel.
 * Uses SIDEPANEL_TO_BACKGROUND port name to distinguish from options page messaging.
 */
export function useSidePanelPortMessaging() {
  const messagingRef = useRef<PortMessaging | null>(null)
  const [connected, setConnected] = useState<boolean>(false)
  
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

    // Connect to background script using sidepanel port name
    const success = messaging.connect(PortName.SIDEPANEL_TO_BACKGROUND, true)
    if (!success) {
      console.warn('[SidePanelPortMessaging] Failed to connect to background script')
    }

    // Cleanup on unmount
    return () => {
      messaging.removeConnectionListener(handleConnectionChange)
      messaging.disconnect()
    }
  }, [])

  /**
   * Send a message to the background script
   * @param type - Message type
   * @param payload - Message payload
   * @param messageId - Optional message ID
   * @returns true if message sent successfully
   */
  const sendMessage = <T>(type: MessageType, payload: T, messageId?: string): boolean => {
    return messagingRef.current?.sendMessage(type, payload, messageId) ?? false
  }

  /**
   * Add a message listener for a specific message type
   * @param type - Message type to listen for
   * @param callback - Function to call when message is received
   */
  const addMessageListener = <T>(
    type: MessageType, 
    callback: (payload: T, messageId?: string) => void
  ): void => {
    messagingRef.current?.addMessageListener(type, callback)
  }

  /**
   * Remove a message listener
   * @param type - Message type
   * @param callback - Callback to remove
   */
  const removeMessageListener = <T>(
    type: MessageType,
    callback: (payload: T, messageId?: string) => void
  ): void => {
    messagingRef.current?.removeMessageListener(type, callback)
  }

  return {
    connected,
    sendMessage,
    addMessageListener,
    removeMessageListener
  }
} 