import React, { useEffect } from 'react'
import { useMessageHandler } from './hooks/useMessageHandler'
import { useSidePanelPortMessaging } from '@/sidepanel/hooks'
import { Chat } from './components/Chat'
import { ErrorBoundary } from './components/ErrorBoundary'
import { useAnnouncer, setGlobalAnnouncer } from './hooks/useAnnouncer'
import { SkipLink } from './components/SkipLink'
import { useSettingsStore } from './stores/settingsStore'
import './styles.css'

/**
 * Root component for sidepanel v2
 * Uses Tailwind CSS for styling
 */
export function App() {
  // Initialize message handling
  useMessageHandler()
  
  // Get connection status from port messaging
  const { connected } = useSidePanelPortMessaging()
  
  // Initialize settings
  const { fontSize, isDarkMode } = useSettingsStore()
  
  // Initialize global announcer for screen readers
  const announcer = useAnnouncer()
  useEffect(() => {
    setGlobalAnnouncer(announcer)
  }, [announcer])
  
  // Initialize settings on app load
  useEffect(() => {
    // Apply font size
    document.documentElement.style.setProperty('--app-font-size', `${fontSize}px`)
    
    // Apply dark mode
    if (isDarkMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [fontSize, isDarkMode])
  
  // Announce connection status changes
  useEffect(() => {
    announcer.announce(connected ? 'Extension connected' : 'Extension disconnected')
  }, [connected, announcer])
  
  return (
    <ErrorBoundary
      onError={(error, errorInfo) => {
        // Log to analytics or error reporting service
        console.error('App level error:', error, errorInfo)
        announcer.announce('An error occurred. Please try again.', 'assertive')
      }}
    >
      <div className="h-screen bg-background" role="main" aria-label="BrowserOS Chat Assistant">
        <SkipLink />
        <Chat isConnected={connected} />
      </div>
    </ErrorBoundary>
  )
}