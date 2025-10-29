import React, { memo, useCallback, useState, useRef, useEffect } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/sidepanel/lib/utils'

interface FeedbackModalProps {
  isOpen: boolean  // Whether modal is visible
  onClose: () => void  // Callback when modal is closed
  onSubmit: (textFeedback: string) => void  // Callback when feedback is submitted
  isSubmitting?: boolean  // Loading state during submission
}

const MAX_FEEDBACK_LENGTH = 500  // Character limit for feedback

export const FeedbackModal = memo<FeedbackModalProps>(function FeedbackModal({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting = false
}) {
  const [textFeedback, setTextFeedback] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  
  // Auto-focus textarea when modal opens
  useEffect(() => {
    if (isOpen && textareaRef.current) {
      textareaRef.current.focus()
    }
  }, [isOpen])

  // Handle form submission
  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault()
    const trimmedFeedback = textFeedback.trim()
    if (trimmedFeedback && !isSubmitting) {
      onSubmit(trimmedFeedback)
    }
  }, [textFeedback, onSubmit, isSubmitting])

  // Handle escape key to close modal
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && !isSubmitting) {
      onClose()
    }
  }, [onClose, isSubmitting])

  // Handle Enter key in textarea to submit (Ctrl+Enter for new line)
  const handleTextareaKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Submit on Enter (unless Ctrl/Cmd is pressed for new line)
    if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey && !isSubmitting) {
      e.preventDefault()
      const trimmedFeedback = textFeedback.trim()
      if (trimmedFeedback) {
        onSubmit(trimmedFeedback)
      }
    }
  }, [textFeedback, onSubmit, isSubmitting])

  // Reset text when modal closes
  useEffect(() => {
    if (!isOpen) {
      setTextFeedback('')
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/20 backdrop-blur-sm"
        onClick={!isSubmitting ? onClose : undefined}
      />
      
      {/* Modal */}
      <div 
        className="relative bg-background border border-border rounded-lg shadow-lg w-full max-w-md mx-4"
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="text-sm font-medium text-foreground">
            Provide feedback
          </h3>
          {!isSubmitting && (
            <button
              onClick={onClose}
              className="p-1 hover:bg-muted rounded-md transition-colors"
              aria-label="Close feedback modal"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          )}
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-4">
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Tell us what went wrong so we can improve BrowserOS-agent.
            </p>
            
            <div className="space-y-2">
              <textarea
                ref={textareaRef}
                value={textFeedback}
                onChange={(e) => setTextFeedback(e.target.value.slice(0, MAX_FEEDBACK_LENGTH))}
                onKeyDown={handleTextareaKeyDown}
                placeholder="Describe the issue you experienced..."
                className={cn(
                  'w-full h-20 px-3 py-2 text-xs',
                  'bg-background border border-border rounded-md',
                  'resize-none focus:outline-none focus:ring-2 focus:ring-brand/20',
                  'placeholder:text-muted-foreground'
                )}
                disabled={isSubmitting}
                required
              />
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">
                  {textFeedback.length}/{MAX_FEEDBACK_LENGTH}
                </span>
                <span className="text-xs text-muted-foreground">
                  Press Enter to submit, Ctrl+Enter for new line
                </span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 mt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className={cn(
                'px-3 py-1.5 text-xs rounded-md transition-colors',
                'bg-muted text-muted-foreground hover:bg-muted/80',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!textFeedback.trim() || isSubmitting}
              className={cn(
                'px-3 py-1.5 text-xs rounded-md transition-colors',
                'bg-brand text-white hover:bg-brand/90',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              {isSubmitting ? 'Submitting...' : 'Submit feedback'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
})
