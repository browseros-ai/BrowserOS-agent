import React from 'react'
import { Button } from '@/sidepanel/components/ui/button'
import { cn } from '@/sidepanel/lib/utils'
import { useSidePanelPortMessaging } from '@/sidepanel/hooks'
import { MessageType } from '@/lib/types/messaging'
import { useChatStore } from '../stores/chatStore'
import styles from '../styles/components/Header.module.scss'

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
    <header className={cn(styles.header, 'flex items-center justify-between p-4 border-b')}>
      <h1 className="text-lg font-semibold">Nxtscape Assistant</h1>
      
      <div className={cn(styles.headerActions, 'flex items-center gap-2')}>
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
            className="text-xs"
          >
            Reset
          </Button>
        )}
      </div>
    </header>
  )
}