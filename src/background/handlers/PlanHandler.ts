import { MessageType } from '@/lib/types/messaging'
import { PortMessage } from '@/lib/runtime/PortMessaging'
import { Logging } from '@/lib/utils/Logging'
import { PlanGeneratorService } from '@/lib/services/PlanGeneratorService'

/**
 * Handles AI plan generation messages from the newtab UI:
 * - GENERATE_PLAN: Generate a new plan using AI
 * - REFINE_PLAN: Refine an existing plan with feedback
 */
export class PlanHandler {
  private planHistory: Array<any> = []  // Plan generation history
  private planGeneratorService: PlanGeneratorService

  constructor() {
    this.planGeneratorService = new PlanGeneratorService()
  }


  /**
   * Handle GENERATE_PLAN message
   */
  async handleGeneratePlan(
    message: PortMessage,
    port: chrome.runtime.Port
  ): Promise<void> {
    try {
      const { input, context, maxSteps } = message.payload as {
        input: string
        context?: string
        maxSteps?: number
      }

      Logging.log('PlanHandler', `Generating plan for: ${input}`, 'info')

      // Generate plan with status updates
      const plan = await this.planGeneratorService.generatePlan(input, {
        context,
        maxSteps,
        onUpdate: (update) => {
          // Send status updates back to the UI
          port.postMessage({
            type: MessageType.PLAN_GENERATION_UPDATE,
            payload: {
              status: update.status,
              content: update.content,
              plan: update.structured ? {
                goal: update.structured.goal,
                name: update.structured.name,
                steps: update.structured.steps.map(s => s.action)
              } : undefined,
              error: update.error
            },
            id: message.id
          })
        }
      })

      // Send final success response
      port.postMessage({
        type: MessageType.PLAN_GENERATION_UPDATE,
        payload: {
          status: 'done',
          plan: {
            goal: plan.goal,
            name: plan.name,
            steps: plan.steps.map(s => s.action)
          }
        },
        id: message.id
      })

      // Store in history
      this.planHistory.push({
        plan,
        timestamp: Date.now(),
        source: 'generated'
      })

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      Logging.log('PlanHandler', `Error generating plan: ${errorMessage}`, 'error')

      port.postMessage({
        type: MessageType.PLAN_GENERATION_UPDATE,
        payload: {
          status: 'error',
          error: errorMessage
        },
        id: message.id
      })
    }
  }

  /**
   * Handle REFINE_PLAN message
   */
  async handleRefinePlan(
    message: PortMessage,
    port: chrome.runtime.Port
  ): Promise<void> {
    try {
      const { currentPlan, feedback, maxSteps } = message.payload as {
        currentPlan: { goal?: string; steps: string[] }
        feedback: string
        maxSteps?: number
      }

      Logging.log('PlanHandler', `Refining plan with feedback: ${feedback}`, 'info')

      // Refine plan with status updates
      const plan = await this.planGeneratorService.refinePlan(currentPlan, feedback, {
        maxSteps,
        onUpdate: (update) => {
          // Send status updates back to the UI
          port.postMessage({
            type: MessageType.PLAN_GENERATION_UPDATE,
            payload: {
              status: update.status,
              content: update.content,
              plan: update.structured ? {
                goal: update.structured.goal,
                name: update.structured.name,
                steps: update.structured.steps.map(s => s.action)
              } : undefined,
              error: update.error
            },
            id: message.id
          })
        }
      })

      // Send final success response
      port.postMessage({
        type: MessageType.PLAN_GENERATION_UPDATE,
        payload: {
          status: 'done',
          plan: {
            goal: plan.goal,
            name: plan.name,
            steps: plan.steps.map(s => s.action)
          }
        },
        id: message.id
      })

      // Store in history
      this.planHistory.push({
        plan,
        timestamp: Date.now(),
        source: 'refined'
      })

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      Logging.log('PlanHandler', `Error refining plan: ${errorMessage}`, 'error')

      port.postMessage({
        type: MessageType.PLAN_GENERATION_UPDATE,
        payload: {
          status: 'error',
          error: errorMessage
        },
        id: message.id
      })
    }
  }
}