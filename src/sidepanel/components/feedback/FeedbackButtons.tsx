import React, { memo, useCallback, useState } from 'react'
import { ThumbsUp, ThumbsDown } from 'lucide-react'
import { cn } from '@/sidepanel/lib/utils'
import type { FeedbackType } from '@/lib/types/feedback'

interface FeedbackButtonsProps {
  messageId: string  // Message ID to associate feedback with
  onFeedback: (messageId: string, type: FeedbackType) => void  // Callback when feedback is given
  isSubmitted?: boolean  // Whether feedback has already been submitted
  submittedType?: FeedbackType  // What type of feedback was submitted
  isSubmitting?: boolean  // Loading state
  className?: string  // Additional CSS classes
}

export const FeedbackButtons = memo<FeedbackButtonsProps>(function FeedbackButtons({
  messageId,
  onFeedback,
  isSubmitted = false,
  submittedType,
  isSubmitting = false,
  className
}) {
  const handleThumbsUp = useCallback(() => {
    if (!isSubmitted && !isSubmitting) {
      onFeedback(messageId, 'thumbs_up')
    }
  }, [messageId, onFeedback, isSubmitted, isSubmitting])

  const handleThumbsDown = useCallback(() => {
    if (!isSubmitted && !isSubmitting) {
      onFeedback(messageId, 'thumbs_down')
    }
  }, [messageId, onFeedback, isSubmitted, isSubmitting])

  return (
    <div className={cn('flex items-center gap-3', className)}>
      {/* Thumbs Up Button */}
      <button
        onClick={handleThumbsUp}
        disabled={isSubmitted || isSubmitting}
        className={cn(
          'p-1.5 rounded-md transition-all duration-200',
          'hover:bg-muted/80 active:bg-muted',
          'focus:outline-none focus:ring-2 focus:ring-brand/20',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          isSubmitted && submittedType === 'thumbs_up' 
            ? 'bg-green-50 text-green-600' 
            : 'text-muted-foreground hover:text-foreground'
        )}
        title={isSubmitted && submittedType === 'thumbs_up' ? 'Feedback submitted' : 'Good response'}
        aria-label={isSubmitted && submittedType === 'thumbs_up' ? 'Positive feedback submitted' : 'Rate response as good'}
      >
        <ThumbsUp className={cn(
          'h-3.5 w-3.5',
          isSubmitted && submittedType === 'thumbs_up' && 'fill-current'
        )} />
      </button>

      {/* Thumbs Down Button */}
      <button
        onClick={handleThumbsDown}
        disabled={isSubmitted || isSubmitting}
        className={cn(
          'p-1.5 rounded-md transition-all duration-200',
          'hover:bg-muted/80 active:bg-muted',
          'focus:outline-none focus:ring-2 focus:ring-brand/20',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          isSubmitted && submittedType === 'thumbs_down' 
            ? 'bg-red-50 text-red-600' 
            : 'text-muted-foreground hover:text-foreground'
        )}
        title={isSubmitted && submittedType === 'thumbs_down' ? 'Feedback submitted' : 'Poor response'}
        aria-label={isSubmitted && submittedType === 'thumbs_down' ? 'Negative feedback submitted' : 'Rate response as poor'}
      >
        <ThumbsDown className={cn(
          'h-3.5 w-3.5',
          isSubmitted && submittedType === 'thumbs_down' && 'fill-current'
        )} />
      </button>
    </div>
  )
})
