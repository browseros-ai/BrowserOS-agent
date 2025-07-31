import React from 'react'
import { Button } from '@/sidepanel/components/ui/button'
import { useSidePanelPortMessaging } from '@/sidepanel/hooks'
import { MessageType } from '@/lib/types/messaging'
import { useChatStore } from '../stores/chatStore'

interface HeaderProps {
  onReset: () => void
  showReset: boolean
  isProcessing: boolean
}

/**
 * Header component for the sidepanel
 * Displays title and action buttons (pause/reset)
 */
export function Header({ onReset, showReset, isProcessing }: HeaderProps) {
  const { sendMessage } = useSidePanelPortMessaging()
  const { setProcessing } = useChatStore()
  
  const handleCancel = () => {
    sendMessage(MessageType.CANCEL_TASK, {
      reason: 'User clicked pause button',
      source: 'sidepanel'
    })
    setProcessing(false)
  }
  
  const handleReset = () => {
    // Send reset message to background
    sendMessage(MessageType.RESET_CONVERSATION, {
      source: 'sidepanel'
    })
    
    // Clear local state
    onReset()
  }

  return (
    <header className="flex items-center justify-between px-6 py-4 border-b border-border bg-background">
      <h1 className="text-lg font-semibold text-foreground">Nxtscape Assistant</h1>
      
      <div className="flex items-center gap-2">
        {isProcessing && (
          <Button
            onClick={handleCancel}
            variant="outline"
            size="sm"
            className="text-xs"
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
          >
            Reset
          </Button>
        )}
      </div>
    </header>
  )
}