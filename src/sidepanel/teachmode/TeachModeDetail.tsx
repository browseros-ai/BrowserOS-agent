import React, { useEffect, useState, useCallback, useRef } from 'react'
import { Play, ArrowLeft } from 'lucide-react'
import { Button } from '@/sidepanel/components/ui/button'
import { SemanticStepTimeline } from './components/SemanticStepTimeline'
import { useTeachModeStore } from './teachmode.store'
import { formatTime } from './teachmode.utils'
import type { SemanticWorkflow } from '@/lib/teach-mode/types'
import { FeedbackButtons } from '@/sidepanel/components/feedback/FeedbackButtons'
import { FeedbackModal } from '@/sidepanel/components/feedback/FeedbackModal'
import { feedbackService } from '@/lib/services/feedbackService'
import type { FeedbackType, FeedbackSubmission } from '@/lib/types/feedback'

export function TeachModeDetail() {
  const { activeRecording, setMode, executeRecording, getWorkflow, updateWorkflow, activeWorkflow } = useTeachModeStore()
  const [workflow, setWorkflow] = useState<SemanticWorkflow | null>(null)
  const [loadingWorkflow, setLoadingWorkflow] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Feedback state
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false)
  const [feedbackType, setFeedbackType] = useState<FeedbackType | undefined>(undefined)
  const [showFeedbackModal, setShowFeedbackModal] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showThankYou, setShowThankYou] = useState(false)

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [])

  // Fetch workflow when activeRecording changes
  useEffect(() => {
    // Clear any pending saves when recording changes
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
      setIsSaving(false)
    }

    if (!activeRecording) return

    // Use cached workflow if available
    if (activeWorkflow && activeWorkflow.metadata.recordingId === activeRecording.id) {
      setWorkflow(activeWorkflow)
      return
    }

    // Fetch workflow from backend
    const fetchWorkflow = async () => {
      setLoadingWorkflow(true)
      try {
        const fetchedWorkflow = await getWorkflow(activeRecording.id)
        setWorkflow(fetchedWorkflow)
      } catch (error) {
        console.error('Failed to fetch workflow:', error)
        setWorkflow(null)
      } finally {
        setLoadingWorkflow(false)
      }
    }

    fetchWorkflow()
  }, [activeRecording, getWorkflow, activeWorkflow])

  // Handle feedback submission - Move hooks before conditional returns
  const handleFeedback = useCallback(async (type: FeedbackType) => {
    if (!activeRecording) return

    if (type === 'thumbs_up') {
      // Submit thumbs up directly
      setIsSubmitting(true)
      try {
        const feedback: FeedbackSubmission = {
          source: 'teachmode',
          type,
          timestamp: new Date(),
          data: {
            workflowName: activeRecording.name,
            workflowGoal: workflow?.metadata?.goal || 'No goal set',
            stepsCount: workflow?.steps?.length || 0,
            hasIcon: !!activeRecording.icon,
            userQuery: 'Workflow configuration',
            agentResponse: workflow?.metadata?.goal || 'No goal set'
          }
        }

        await feedbackService.submitFeedback(feedback)
        setFeedbackSubmitted(true)
        setFeedbackType('thumbs_up')
        setShowThankYou(true)
        setTimeout(() => {
          setShowThankYou(false)
        }, 2000)
      } catch (error) {
        console.error('Failed to submit feedback:', error)
      } finally {
        setIsSubmitting(false)
      }
    } else {
      // Show modal for thumbs down
      setShowFeedbackModal(true)
    }
  }, [activeRecording, workflow])

  // Handle modal submission
  const handleModalSubmit = useCallback(async (textFeedback: string) => {
    if (!activeRecording) return

    setIsSubmitting(true)
    try {
      const feedback: FeedbackSubmission = {
        source: 'teachmode',
        type: 'thumbs_down',
        user_feedback: textFeedback,
        timestamp: new Date(),
        data: {
          workflowName: activeRecording.name,
          workflowGoal: workflow?.metadata?.goal || 'No goal set',
          stepsCount: workflow?.steps?.length || 0,
          hasIcon: !!activeRecording.icon,
          userQuery: 'Workflow configuration',
          agentResponse: workflow?.metadata?.goal || 'No goal set'
        }
      }

      await feedbackService.submitFeedback(feedback)
      setFeedbackSubmitted(true)
      setFeedbackType('thumbs_down')
      setShowFeedbackModal(false)
      setShowThankYou(true)
      setTimeout(() => {
        setShowThankYou(false)
      }, 2000)
    } catch (error) {
      console.error('Failed to submit feedback:', error)
    } finally {
      setIsSubmitting(false)
    }
  }, [activeRecording, workflow])

  // Non-hook functions - defined after all hooks
  const handleBack = () => {
    setMode('idle')
  }

  const handleRunNow = () => {
    if (activeRecording) {
      executeRecording(activeRecording.id)
    }
  }

  const handleSchedule = () => {
    // Future enhancement
    console.log('Schedule workflow')
  }

  // Conditional returns must come after all hooks
  if (!activeRecording) {
    return null
  }

  return (
    <div className="flex flex-col h-full bg-background-alt">
      {/* Internal navigation */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
        <button
          onClick={handleBack}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors p-1"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Workflows</span>
        </button>
        <Button
          onClick={handleRunNow}
          size="sm"
          variant="outline"
          className="gap-1.5 border-[hsl(var(--brand))] text-[hsl(var(--brand))] hover:bg-[hsl(var(--brand))] hover:text-white transition-colors"
        >
          <Play className="w-3.5 h-3.5" />
          Run Now
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* Workflow Title - Clean and minimal */}
        <div className="mb-6">
          <div className="flex items-center gap-2">
            {activeRecording.icon && (
              <span>{activeRecording.icon}</span>
            )}
            <h2 className="text-base font-semibold text-foreground">
              {activeRecording.name}
            </h2>
          </div>
        </div>

        {/* Workflow Content */}
        <div>
          <h3 className="text-sm font-medium text-muted-foreground/80 mb-3">
            Workflow Steps
          </h3>
          <SemanticStepTimeline
            workflow={workflow}
            loading={loadingWorkflow}
            isSaving={isSaving}
            onGoalUpdate={(newGoal: string) => {
              if (workflow && activeRecording) {
                // Update local state immediately (optimistic update)
                const updatedWorkflow = {
                  ...workflow,
                  metadata: {
                    ...workflow.metadata,
                    goal: newGoal
                  }
                }
                setWorkflow(updatedWorkflow)

                // Clear existing timeout
                if (saveTimeoutRef.current) {
                  clearTimeout(saveTimeoutRef.current)
                }

                // Debounce the backend save (500ms delay)
                setIsSaving(true)
                saveTimeoutRef.current = setTimeout(async () => {
                  try {
                    const success = await updateWorkflow(
                      activeRecording.id,
                      {
                        metadata: {
                          ...updatedWorkflow.metadata
                        }
                      }
                    )

                    if (!success) {
                      console.error('Failed to save workflow goal')
                      // Could show a toast notification here
                    }
                  } catch (error) {
                    console.error('Error updating workflow:', error)
                  } finally {
                    setIsSaving(false)
                  }
                }, 500)
              }
            }}
          />
        </div>

        {/* Feedback section at bottom */}
        {(!feedbackSubmitted || showThankYou) && (
          <div className="mt-6 pt-4 border-t border-border">
            <div className="flex items-center justify-center gap-3">
              {!feedbackSubmitted && (
                <>
                  <span className="text-sm text-muted-foreground">Is this workflow configuration helpful?</span>
                  <FeedbackButtons
                    messageId={activeRecording.id}
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