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
      const payload = {
        source: feedback.source,
        timestamp: feedback.timestamp.toISOString(),
        user_feedback: feedback.user_feedback,
        type: feedback.type,
        data: feedback.data
      }

      // Create timeout controller
      const controller = this._createTimeoutController()

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
        source: feedback.source,
        type: feedback.type,
        hasUserFeedback: !!feedback.user_feedback,
        timestamp: feedback.timestamp
      })

      // Log metric for successful feedback submission
      await Logging.logMetric('feedback.submitted', {
        source: feedback.source,
        type: feedback.type,
        hasUserFeedback: !!feedback.user_feedback,
        ...feedback.data
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
        source: feedback.source,
        type: feedback.type,
        error: error instanceof Error ? error.message : 'Unknown error',
        isTimeout: error instanceof Error && error.name === 'AbortError',
        ...feedback.data
      })

      throw new Error('Failed to submit feedback')
    }
  }
}

export const feedbackService = FeedbackService.getInstance()
