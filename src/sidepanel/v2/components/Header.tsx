import React, { memo } from 'react'
import { Button } from '@/sidepanel/components/ui/button'
import { useSidePanelPortMessaging } from '@/sidepanel/hooks'
import { MessageType } from '@/lib/types/messaging'
import { useChatStore } from '../stores/chatStore'
import { useAnalytics } from '../hooks/useAnalytics'

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

  return (
    <header 
      className="flex items-center justify-between px-6 py-4 border-b border-border bg-background"
      role="banner"
    >
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-semibold text-foreground">Nxtscape Assistant</h1>
        
        {/* Connection status indicator */}
        <div 
          className="flex items-center gap-1.5"
          role="status"
          aria-label={`Connection status: ${connected ? 'Connected' : 'Disconnected'}`}
        >
          <div 
            className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`}
            aria-hidden="true"
          />
          <span className="text-xs text-muted-foreground">
            {connected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
      </div>
      
      <nav className="flex items-center gap-2" role="navigation" aria-label="Chat controls">
        {isProcessing && (
          <Button
            onClick={handleCancel}
            variant="outline"
            size="sm"
            className="text-xs"
            aria-label="Pause current task"
          >
            Pause
          </Button>
        )}
        
        {showReset && !isProcessing && (
          <Button
            onClick={handleReset}
            variant="ghost"
            size="sm"
            className="text-xs hover:bg-accent"
            aria-label="Reset conversation"
          >
            Reset
          </Button>
        )}
      </nav>
    </header>
  )
})