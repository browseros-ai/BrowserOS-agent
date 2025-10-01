import React, { useState, useCallback } from 'react'
import { CheckCircle, AlertCircle, RefreshCw, FileText, Home, Square } from 'lucide-react'
import { Button } from '@/sidepanel/components/ui/button'
import { useTeachModeStore } from './teachmode.store'
import { formatDuration } from './teachmode.utils'
import { cn } from '@/sidepanel/lib/utils'
import { FeedbackButtons } from '@/sidepanel/components/feedback/FeedbackButtons'
import { FeedbackModal } from '@/sidepanel/components/feedback/FeedbackModal'
import { feedbackService } from '@/lib/services/feedbackService'
import type { FeedbackType, FeedbackSubmission } from '@/lib/types/feedback'
import { MarkdownContent } from '@/sidepanel/components/shared/Markdown'

export function TeachModeSummary() {
  const { executionSummary, activeRecording, setMode, executeRecording } = useTeachModeStore()

  // Feedback state
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false)
  const [feedbackType, setFeedbackType] = useState<FeedbackType | undefined>(undefined)
  const [showFeedbackModal, setShowFeedbackModal] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showThankYou, setShowThankYou] = useState(false)

  if (!executionSummary || !activeRecording) {
    return null
  }

  const handleRunAgain = () => {
    executeRecording(activeRecording.id)
  }

  const handleViewDetails = () => {
    setMode('ready')
  }

  const handleDone = () => {
    setMode('idle')
  }

  const isSuccess = executionSummary.success
  const isAborted = !isSuccess && executionSummary.results?.includes('Execution aborted by user')
  const isPartialSuccess = !isSuccess && executionSummary.stepsCompleted > 0

  // Handle feedback submission
  const handleFeedback = useCallback(async (type: FeedbackType) => {
    if (type === 'thumbs_up') {
      // Submit thumbs up directly
      setIsSubmitting(true)
      try {
        const feedback: FeedbackSubmission = {
          source: 'teachmode',
          type,
          timestamp: new Date(),
          data: {
            workflowName: executionSummary.recordingName,
            executionStatus: isSuccess ? 'success' : isAborted ? 'aborted' : 'failed',
            executionDuration: executionSummary.duration,
            stepsCompleted: executionSummary.stepsCompleted,
            totalSteps: executionSummary.totalSteps,
            userQuery: 'Workflow execution',
            agentResponse: isSuccess ?
              executionSummary.results.join(', ') :
              executionSummary.errorMessage || 'Execution failed'
          }
        }

        await feedbackService.submitFeedback(feedback)
        setFeedbackSubmitted(true)
        setFeedbackType('thumbs_up')
        setShowThankYou(true)
        setTimeout(() => setShowThankYou(false), 2000)
      } catch (error) {
        console.error('Failed to submit feedback:', error)
      } finally {
        setIsSubmitting(false)
      }
    } else {
      // Show modal for thumbs down
      setShowFeedbackModal(true)
    }
  }, [executionSummary, isSuccess, isAborted])

  // Handle modal submission
  const handleModalSubmit = useCallback(async (textFeedback: string) => {
    setIsSubmitting(true)
    try {
      const feedback: FeedbackSubmission = {
        source: 'teachmode',
        type: 'thumbs_down',
        user_feedback: textFeedback,
        timestamp: new Date(),
        data: {
          workflowName: executionSummary.recordingName,
          executionStatus: isSuccess ? 'success' : isAborted ? 'aborted' : 'failed',
          executionDuration: executionSummary.duration,
          stepsCompleted: executionSummary.stepsCompleted,
          totalSteps: executionSummary.totalSteps,
          userQuery: 'Workflow execution',
          agentResponse: isSuccess ?
            executionSummary.results.join(', ') :
            executionSummary.errorMessage || 'Execution failed'
        }
      }

      await feedbackService.submitFeedback(feedback)
      setFeedbackSubmitted(true)
      setFeedbackType('thumbs_down')
      setShowFeedbackModal(false)
      setShowThankYou(true)
      setTimeout(() => setShowThankYou(false), 2000)
    } catch (error) {
      console.error('Failed to submit feedback:', error)
    } finally {
      setIsSubmitting(false)
    }
  }, [executionSummary, isSuccess, isAborted])

  return (
    <div className="flex flex-col h-full bg-background-alt">
      {/* Header */}
      <div className="px-4 py-4 border-b border-border">
        <h2 className="text-lg font-semibold text-foreground">
          {isSuccess ? 'Workflow Complete' :
           isAborted ? 'Workflow Aborted' :
           'Workflow Stopped'}
        </h2>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        {/* Status icon */}
        <div className="flex justify-center mb-6">
          <div className={cn(
            "w-16 h-16 rounded-full flex items-center justify-center",
            isSuccess ? "bg-green-500/10" :
            isAborted ? "bg-gray-500/10" :
            "bg-yellow-500/10"
          )}>
            {isSuccess ? (
              <CheckCircle className="w-8 h-8 text-green-500" />
            ) : isAborted ? (
              <Square className="w-8 h-8 text-gray-500 fill-gray-500" />
            ) : (
              <AlertCircle className="w-8 h-8 text-yellow-500" />
            )}
          </div>
        </div>

        {/* Status badge */}
        <div className="text-center mb-6">
          <span className={cn(
            "text-lg font-medium",
            isSuccess ? "text-green-500" :
            isAborted ? "text-muted-foreground" :
            isPartialSuccess ? "text-yellow-500" :
            "text-destructive"
          )}>
            {isSuccess ? 'Success' :
             isAborted ? 'Aborted' :
             isPartialSuccess ? 'Partial Success' :
             'Failed'}
          </span>
        </div>

        {/* Feedback section - subtle and contextual */}
        {(!feedbackSubmitted || showThankYou) && (
          <div className="flex justify-center mb-6">
            <div className="flex items-center gap-3">
              {!feedbackSubmitted && (
                <>
                  <span className="text-sm text-muted-foreground">Was this execution helpful?</span>
                  <FeedbackButtons
                    messageId={executionSummary.recordingName}
                    onFeedback={(_, type) => handleFeedback(type)}
                    isSubmitted={feedbackSubmitted}
                    submittedType={feedbackType}
                    isSubmitting={isSubmitting}
                  />
                </>
              )}

              {feedbackSubmitted && showThankYou && (
                <div className="text-sm text-green-600 bg-green-50 px-3 py-1 rounded-md animate-in fade-in-0 slide-in-from-bottom-1">
                  Thanks for your feedback!
                </div>
              )}
            </div>
          </div>
        )}

        {/* Results card */}
        <div className="bg-background-alt rounded-lg border border-border p-4 space-y-3">
          <h3 className="font-medium text-foreground">
            {executionSummary.recordingName}
          </h3>

          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Duration</span>
              <span className="text-foreground">
                {formatDuration(executionSummary.duration)}
              </span>
            </div>
          </div>

          {/* Success results */}
          {isSuccess && executionSummary.results.length > 0 && (
            <div className="pt-3 border-t border-border">
              <div className="text-sm font-medium text-foreground mb-2">
                Results:
              </div>
              <MarkdownContent
                content={executionSummary.results.join('\n\n')}
                className="text-muted-foreground"
                compact={false}
              />
            </div>
          )}

          {/* Aborted message */}
          {isAborted && (
            <div className="pt-3 border-t border-border">
              <p className="text-sm text-muted-foreground">
                Workflow execution was stopped by user request.
              </p>
            </div>
          )}

          {/* Failure details */}
          {!isSuccess && !isAborted && executionSummary.errorMessage && (
            <div className="pt-3 border-t border-border">
              <div className="text-sm font-medium text-foreground mb-1">
                Error Details:
              </div>
              <p className="text-sm text-destructive">
                {executionSummary.errorMessage}
              </p>
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="mt-6 space-y-2">
          {isSuccess ? (
            <>
              <Button
                onClick={handleRunAgain}
                variant="outline"
                className="w-full gap-2 border-[hsl(var(--brand))] text-[hsl(var(--brand))] hover:bg-[hsl(var(--brand))] hover:text-white transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Run Again
              </Button>
              <Button
                onClick={handleViewDetails}
                variant="outline"
                className="w-full gap-2"
              >
                <FileText className="w-4 h-4" />
                View Details
              </Button>
            </>
          ) : (
            <Button
              onClick={handleRunAgain}
              variant="outline"
              className="w-full gap-2 border-[hsl(var(--brand))] text-[hsl(var(--brand))] hover:bg-[hsl(var(--brand))] hover:text-white transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Try Again
            </Button>
          )}

          <Button
            onClick={handleDone}
            variant="ghost"
            className="w-full gap-2 hover:bg-accent transition-colors"
          >
            <Home className="w-4 h-4" />
            Done
          </Button>
        </div>
      </div>

      {/* Feedback modal */}
      {showFeedbackModal && (
        <FeedbackModal
          isOpen={showFeedbackModal}
          onClose={() => setShowFeedbackModal(false)}
          onSubmit={handleModalSubmit}
          isSubmitting={isSubmitting}
        />
      )}
    </div>
  )
}