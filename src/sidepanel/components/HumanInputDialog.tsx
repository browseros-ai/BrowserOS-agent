import React from 'react'
import { Button } from './ui/button'
import { useSidePanelPortMessaging } from '@/sidepanel/hooks'
import { MessageType } from '@/lib/types/messaging'

interface HumanInputDialogProps {
  requestId: string
  prompt: string
  onClose: () => void
}

/**
 * Dialog shown when agent requests human input
 * Matches the UI design from the screenshot with Done and Skip this site buttons
 */
export function HumanInputDialog({ requestId, prompt, onClose }: HumanInputDialogProps) {
  const { sendMessage } = useSidePanelPortMessaging()
  
  const handleDone = () => {
    // Send response back through port message
    sendMessage(MessageType.HUMAN_INPUT_RESPONSE, {
      requestId,
      action: 'done'
    })
    onClose()
  }
  
  const handleSkip = () => {
    // Send abort response
    sendMessage(MessageType.HUMAN_INPUT_RESPONSE, {
      requestId,
      action: 'abort'
    })
    onClose()
  }
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" />
      
      {/* Dialog */}
      <div className="relative bg-amber-50 dark:bg-amber-900/20 rounded-lg border-2 border-amber-400 dark:border-amber-600 p-6 max-w-md mx-4 shadow-xl">
        {/* Warning icon */}
        <div className="flex items-start gap-3 mb-4">
          <div className="flex-shrink-0 text-amber-600 dark:text-amber-400">
            <svg className="w-6 h-6" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
              <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
            </svg>
          </div>
          
          {/* Content */}
          <div className="flex-1">
            <h3 className="text-amber-900 dark:text-amber-100 font-semibold mb-2">
              Task Pending
            </h3>
            <p className="text-amber-800 dark:text-amber-200 text-sm mb-4">
              {prompt}
            </p>
            <p className="text-amber-700 dark:text-amber-300 text-xs">
              Please complete the required action manually, then click "Done" to continue. 
              Click "Abort task" to cancel the current operation.
            </p>
          </div>
        </div>
        
        {/* Buttons */}
        <div className="flex gap-3 justify-end">
          <Button
            onClick={handleDone}
            className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded"
          >
            ✓ Done
          </Button>
          <Button
            onClick={handleSkip}
            variant="outline"
            className="border-amber-400 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/30 px-4 py-2 rounded"
          >
            Abort task
          </Button>
        </div>
      </div>
    </div>
  )
}