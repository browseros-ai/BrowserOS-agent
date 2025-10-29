import React, { useEffect, useState } from 'react'
import { useMessageHandler } from './hooks/useMessageHandler'
import { useSidePanelPortMessaging } from '@/sidepanel/hooks'
import { Chat } from './components/Chat'
import { TeachMode, useTeachModeStore } from './teachmode'
import { ErrorBoundary } from './components/ErrorBoundary'
import { useAnnouncer, setGlobalAnnouncer } from './hooks/useAnnouncer'
import { SkipLink } from './components/SkipLink'
import { useSettingsStore } from './stores/settingsStore'
import { HumanInputDialog } from './components/HumanInputDialog'
import { Header } from './components/Header'
import { ModeToggle } from './components/ModeToggle'
import { useChatStore } from './stores/chatStore'
import './styles.css'

/**
 * Root component for sidepanel v2
 * Uses Tailwind CSS for styling
 */
export function App() {
  // Get connection status from port messaging
  const { connected } = useSidePanelPortMessaging()

  // Initialize message handling
  const { humanInputRequest, clearHumanInputRequest } = useMessageHandler()

  // Initialize settings
  const { fontSize, theme, appMode } = useSettingsStore()

  // Get chat state for header
  const { messages, isProcessing, reset } = useChatStore()

  // Get teach mode state for header
  const { teachModeState, abortTeachExecution } = useTeachModeStore(state => ({
    teachModeState: state.mode,
    abortTeachExecution: state.abortExecution
  }))

  // Check if any execution is running (chat or teach mode)
  const isExecuting = isProcessing || teachModeState === 'executing'
  
  // Initialize global announcer for screen readers
  const announcer = useAnnouncer()
  useEffect(() => {
    setGlobalAnnouncer(announcer)
  }, [announcer])
  
  // Initialize settings on app load
  useEffect(() => {
    // Apply font size
    document.documentElement.style.setProperty('--app-font-size', `${fontSize}px`)

    // Apply theme classes
    const root = document.documentElement
    root.classList.remove('dark')
    root.classList.remove('gray')
    if (theme === 'dark') root.classList.add('dark')
    if (theme === 'gray') root.classList.add('gray')
  }, [fontSize, theme])

  // Listen for theme changes from other tabs/views
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'nxtscape-settings' && e.newValue) {
        try {
          const newSettings = JSON.parse(e.newValue)
          const newTheme = newSettings?.state?.theme
          const newFontSize = newSettings?.state?.fontSize

          // Update theme if changed
          if (newTheme && newTheme !== theme) {
            const root = document.documentElement
            root.classList.remove('dark', 'gray')
            if (newTheme === 'dark') root.classList.add('dark')
            if (newTheme === 'gray') root.classList.add('gray')
            // Force store update
            useSettingsStore.setState({ theme: newTheme })
          }

          // Update font size if changed
          if (newFontSize && newFontSize !== fontSize) {
            document.documentElement.style.setProperty('--app-font-size', `${newFontSize}px`)
            useSettingsStore.setState({ fontSize: newFontSize })
          }
        } catch (err) {
          console.error('Failed to parse settings from storage:', err)
        }
      }
    }

    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [theme, fontSize])
  
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
      <div className="h-screen bg-background overflow-x-hidden flex flex-col" role="main" aria-label="BrowserOS Chat Assistant">
        <SkipLink />

        {/* Header - always visible at top */}
        <Header
          onReset={() => {
            // Reset based on current mode
            if (appMode === 'teach' && teachModeState === 'executing') {
              abortTeachExecution()
            } else {
              reset()
            }
          }}
          showReset={messages.length > 0 || (appMode === 'teach' && teachModeState !== 'idle')}
          isProcessing={isExecuting}
          isTeachMode={appMode === 'teach'}
        />

        {/* Main content area - changes based on mode */}
        <div className="flex-1 min-h-0 overflow-hidden">
          {appMode === 'teach' ? (
            <TeachMode />
          ) : (
            <Chat
              isConnected={connected}
            />
          )}
        </div>

        {/* Mode Toggle - always visible at bottom */}
        <div className="border-t border-border bg-background px-2 py-2">
          <ModeToggle />
        </div>

        {humanInputRequest && (
          <HumanInputDialog
            requestId={humanInputRequest.requestId}
            prompt={humanInputRequest.prompt}
            onClose={clearHumanInputRequest}
          />
        )}
      </div>
    </ErrorBoundary>
  )
}