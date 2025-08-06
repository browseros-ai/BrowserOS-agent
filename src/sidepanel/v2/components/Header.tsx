import React, { memo, useState, useEffect } from 'react'
import { Button } from '@/sidepanel/components/ui/button'
import { useSidePanelPortMessaging } from '@/sidepanel/hooks'
import { MessageType } from '@/lib/types/messaging'
import { useChatStore } from '../stores/chatStore'
import { useAnalytics } from '../hooks/useAnalytics'
import { SettingsModal } from './SettingsModal'

interface HeaderProps {
  onReset: () => void
  showReset: boolean
  isProcessing: boolean
}

/**
 * Header component for the sidepanel
 * Displays title, connection status, and action buttons (pause/reset)
 * Memoized to prevent unnecessary re-renders
 */
export const Header = memo(function Header({ onReset, showReset, isProcessing }: HeaderProps) {
  const { sendMessage, connected } = useSidePanelPortMessaging()
  const { setProcessing } = useChatStore()
  const { trackClick } = useAnalytics()
  const [showSettings, setShowSettings] = useState(false)
  const [isDarkMode, setIsDarkMode] = useState(false)

  // Check current theme on mount and listen for changes
  useEffect(() => {
    const checkTheme = () => {
      const isDark = document.documentElement.classList.contains('dark')
      setIsDarkMode(isDark)
    }

    // Check initial theme
    checkTheme()

    // Listen for theme changes
    const observer = new MutationObserver(checkTheme)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    })

    return () => observer.disconnect()
  }, [])
  
  const handleCancel = () => {
    trackClick('pause_task')
    sendMessage(MessageType.CANCEL_TASK, {
      reason: 'User clicked pause button',
      source: 'sidepanel'
    })
    setProcessing(false)
  }
  
  const handleReset = () => {
    trackClick('reset_conversation')
    // Send reset message to background
    sendMessage(MessageType.RESET_CONVERSATION, {
      source: 'sidepanel'
    })
    
    // Clear local state
    onReset()
  }

  const handleSettingsClick = () => {
    trackClick('open_settings')
    setShowSettings(true)
  }

  return (
    <header 
      className="flex items-center justify-between px-4 py-1 bg-gradient-to-r from-background via-background to-background/95 border-b border-border/50"
      role="banner"
    >

      <a href="https://www.browseros.com/" target="_blank" rel="noopener noreferrer" className="block">
        <div className="flex items-center px-1 py-.8 rounded-lg bg-[hsl(var(--card))] cursor-pointer hover:opacity-90 transition">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <div>
              <img
                src={isDarkMode ? "/assets/product_logo_name_22_white.png" : "/assets/product_logo_name_22_2x.png"}
                alt="BrowserOS"
                className="h-6"
              />
            </div>
          </div>
          {/* Connection status indicator */}
          <div
            className="flex items-center"
            role="status"
            aria-label={`Connection status: ${connected ? 'Connected' : 'Disconnected'}`}
          >
            <div
              className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}
              aria-hidden="true"
            />
          </div>
        </div>
      </a>
      
      <nav className="flex items-center gap-2" role="navigation" aria-label="Chat controls">
        {/* Settings button */}
        <Button
          onClick={handleSettingsClick}
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 hover:bg-brand/5 hover:text-brand transition-all duration-300"
          aria-label="Open settings"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </Button>

        {isProcessing && (
          <Button
            onClick={handleCancel}
            variant="outline"
            size="sm"
            className="text-xs border-brand/30 hover:border-brand hover:bg-brand/5 transition-all duration-300"
            aria-label="Pause current task"
          >
            <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6" />
            </svg>
            Pause
          </Button>
        )}
        
        {showReset && !isProcessing && (
          <Button
            onClick={handleReset}
            variant="ghost"
            size="sm"
            className="text-xs hover:bg-brand/5 hover:text-brand transition-all duration-300"
            aria-label="Reset conversation"
          >
            <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Reset
          </Button>
        )}
      </nav>

      {/* Settings Modal */}
      <SettingsModal 
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
      />
    </header>
  )
})