import { MessageType } from '@/lib/types/messaging'
import { PortMessage } from '@/lib/runtime/PortMessaging'
import { Logging } from '@/lib/utils/Logging'
import { Execution } from '@/lib/execution/Execution'
import { PubSub } from '@/lib/pubsub'

/**
 * Handles planning-related messages:
 * - GET_CURRENT_PLAN: Get the current execution plan
 * - UPDATE_PLAN: Modify the execution plan
 * - GET_PLAN_HISTORY: Get history of plan changes
 */
export class PlanHandler {
  private execution: Execution
  private planHistory: Array<any> = []  // Single plan history for singleton

  constructor() {
    this.execution = Execution.getInstance()
  }

  /**
   * Handle GET_CURRENT_PLAN message
   */
  handleGetCurrentPlan(
    message: PortMessage,
    port: chrome.runtime.Port
  ): void {
    try {
      // Get current plan from execution's message history or state
      const currentPlan = this.extractCurrentPlan(this.execution)
      
      port.postMessage({
        type: MessageType.WORKFLOW_STATUS,
        payload: { 
          status: 'success',
          data: { 
            plan: currentPlan
          }
        },
        id: message.id
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      Logging.log('PlanHandler', `Error getting current plan: ${errorMessage}`, 'error')
      
      port.postMessage({
        type: MessageType.WORKFLOW_STATUS,
        payload: { 
          status: 'error',
          error: errorMessage
        },
        id: message.id
      })
    }
  }

  /**
   * Handle UPDATE_PLAN message
   */
  handleUpdatePlan(
    message: PortMessage,
    port: chrome.runtime.Port
  ): void {
    try {
      const { plan } = message.payload as { plan: any }
      
      // Store plan in history
      this.planHistory.push({
        plan,
        timestamp: Date.now(),
        source: 'manual_update'
      })
      
      // Publish plan update event via PubSub
      const channel = PubSub.getChannel("main")
      channel.publishMessage({
        msgId: `plan_update_${Date.now()}`,
        role: 'assistant',  // Use 'assistant' instead of 'system' which doesn't exist
        content: JSON.stringify({
          type: 'plan_update',
          plan,
          timestamp: Date.now()
        }),
        ts: Date.now()
      })
      
      Logging.log('PlanHandler', `Updated plan`)
      
      port.postMessage({
        type: MessageType.WORKFLOW_STATUS,
        payload: { 
          status: 'success',
          message: 'Plan updated'
        },
        id: message.id
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      Logging.log('PlanHandler', `Error updating plan: ${errorMessage}`, 'error')
      
      port.postMessage({
        type: MessageType.WORKFLOW_STATUS,
        payload: { 
          status: 'error',
          error: errorMessage
        },
        id: message.id
      })
    }
  }

  /**
   * Handle GET_PLAN_HISTORY message
   */
  handleGetPlanHistory(
    message: PortMessage,
    port: chrome.runtime.Port
  ): void {
    try {
      port.postMessage({
        type: MessageType.WORKFLOW_STATUS,
        payload: { 
          status: 'success',
          data: { 
            history: this.planHistory,
            count: this.planHistory.length
          }
        },
        id: message.id
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      Logging.log('PlanHandler', `Error getting plan history: ${errorMessage}`, 'error')
      
      port.postMessage({
        type: MessageType.WORKFLOW_STATUS,
        payload: { 
          status: 'error',
          error: errorMessage
        },
        id: message.id
      })
    }
  }

  /**
   * Extract current plan from execution
   */
  private extractCurrentPlan(execution: any): any {
    // Look for plan in execution's message history
    // This would normally parse the MessageManager's history for PlannerTool output
    
    // For now, return a placeholder
    return {
      steps: [],
      status: 'unknown',
      timestamp: Date.now()
    }
  }

  /**
   * Clear plan history
   */
  clearHistory(): void {
    this.planHistory = []
    Logging.log('PlanHandler', `Cleared plan history`)
  }
}