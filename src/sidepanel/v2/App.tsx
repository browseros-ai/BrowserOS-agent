import React from 'react'
import { useMessageHandler } from './hooks/useMessageHandler'
import { useSidePanelPortMessaging } from '@/sidepanel/hooks'
import { Chat } from './components/Chat'

/**
 * Root component for sidepanel v2
 * Uses Tailwind CSS for styling
 */
export function App() {
  // Initialize message handling
  useMessageHandler()
  
  // Get connection status from port messaging
  const { connected } = useSidePanelPortMessaging()
  
  return (
    <div className="h-screen bg-background">
      <Chat isConnected={connected} />
    </div>
  )
}