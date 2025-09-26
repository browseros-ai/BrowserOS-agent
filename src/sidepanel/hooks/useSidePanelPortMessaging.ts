import { useEffect, useRef, useState, useCallback } from 'react'
import { PortMessaging } from '@/lib/runtime/PortMessaging'
import { MessageType } from '@/lib/types/messaging'

/**
 * Custom hook for managing port messaging for the side panel.
 * Uses a fixed port name for the singleton execution.
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

    // Initialize connection with fixed port name
    const initializeConnection = () => {
      try {
        // Set up connection listener
        const handleConnectionChange = (isConnected: boolean) => {
          setConnected(isConnected)
        }

        messaging.addConnectionListener(handleConnectionChange)

        // Connect to background script using fixed port name
        const success = messaging.connect("sidepanel", true)
        
        if (!success) {
          console.error(`[SidePanelPortMessaging] Failed to connect`)
        } else {
          console.log(`[SidePanelPortMessaging] Connected successfully`)
        }
      } catch (error) {
        console.error('[SidePanelPortMessaging] Error during connection:', error)
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
   * Send a message and wait for a response
   * @param type - Message type
   * @param payload - Message payload
   * @param timeoutMs - Optional timeout in milliseconds (default 30000)
   * @returns Promise that resolves with the response payload
   */
  const sendMessageWithResponse = useCallback(async <T>(
    type: MessageType,
    payload: unknown,
    timeoutMs?: number
  ): Promise<T> => {
    if (!messagingRef.current) {
      throw new Error('Port messaging not initialized')
    }
    return messagingRef.current.sendMessageWithResponse<T>(type, payload, timeoutMs)
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
    sendMessage,
    sendMessageWithResponse,
    addMessageListener,
    removeMessageListener
  }
} 
