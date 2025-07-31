import React from 'react'
import { useMessageHandler } from './hooks/useMessageHandler'
import { useSidePanelPortMessaging } from '@/sidepanel/hooks'
import { Chat } from './components/Chat'
import './styles/global.css'

/**
 * Root component for sidepanel v2
 * Phase 2: Full UI implementation with Chat component
 */
export function App() {
  // Initialize message handling
  useMessageHandler()
  
  // Get connection status from port messaging
  const { connected } = useSidePanelPortMessaging()
  
  return (
    <div className="sidepanel-v2" style={{ height: '100vh' }}>
      <Chat isConnected={connected} />
    </div>
  )
}