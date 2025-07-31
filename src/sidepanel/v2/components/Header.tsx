import React from 'react'
import { Button } from '@/sidepanel/components/ui/button'
import { cn } from '@/sidepanel/lib/utils'
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
  const handleCancel = () => {
    // Cancel logic will be implemented when port messaging is wired up
    console.log('Cancel processing')
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
            onClick={onReset}
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