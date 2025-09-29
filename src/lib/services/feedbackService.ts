import type { FeedbackSubmission } from '@/lib/types/feedback'
import { Logging } from '@/lib/utils/Logging'

/**
 * Cloudflare Worker Feedback Service
 * Handles feedback submission to Cloudflare Worker API
 */

const FEEDBACK_API_URL = 'https://cdn.browseros.com/api/agent-feedback'
const REQUEST_TIMEOUT_MS = 10000  // 10 second timeout

class FeedbackService {
  private static instance: FeedbackService;

  static getInstance(): FeedbackService {
    if (!FeedbackService.instance) {
      FeedbackService.instance = new FeedbackService()
    }
    return FeedbackService.instance
  }

  /**
   * Create an AbortController with timeout
   */
  private _createTimeoutController(): AbortController {
    const controller = new AbortController()
    setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
    return controller
  }

  /**
   * Submit feedback to Cloudflare Worker API
   */
  async submitFeedback(feedback: FeedbackSubmission): Promise<void> {
    try {
      // Prepare the request payload matching AgentFeedbackRequest interface
      const payload = {
        feedbackId: feedback.feedbackId,
        messageId: feedback.messageId,
        sessionId: feedback.sessionId,
        type: feedback.type,
        timestamp: feedback.timestamp,
        textFeedback: feedback.textFeedback,
        userQuery: feedback.userQuery,
        agentResponse: feedback.agentResponse
      }

      // Create timeout controller
      const controller = this._createTimeoutController()

      // Send request to Cloudflare Worker API
      const response = await fetch(FEEDBACK_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      })

      // Parse response
      const result = await response.json()

      if (!response.ok) {
        console.error('Failed to submit feedback:', result)
        throw new Error(result.error || 'Failed to submit feedback')
      }

      console.log('Feedback successfully submitted:', {
        feedbackId: feedback.feedbackId,
        messageId: feedback.messageId,
        type: feedback.type,
        hasTextFeedback: !!feedback.textFeedback,
        timestamp: feedback.timestamp
      })

      // Log metric for successful feedback submission
      await Logging.logMetric('feedback.submitted', {
        type: feedback.type,
        hasTextFeedback: !!feedback.textFeedback,
        userQuery: feedback.userQuery,
        agentResponse: feedback.agentResponse
      })

    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          console.error('Feedback submission timed out after', REQUEST_TIMEOUT_MS, 'ms')
          throw new Error('Feedback submission timed out')
        }
      }
      console.error('Failed to submit feedback:', error)

      // Log metric for failed feedback submission
      await Logging.logMetric('feedback.failed', {
        type: feedback.type,
        error: error instanceof Error ? error.message : 'Unknown error',
        isTimeout: error instanceof Error && error.name === 'AbortError',
        userQuery: feedback.userQuery,
        agentResponse: feedback.agentResponse
      })

      throw new Error('Failed to submit feedback')
    }
  }
}

export const feedbackService = FeedbackService.getInstance()
