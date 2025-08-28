import { MessageType } from '@/lib/types/messaging'
import { PortMessage } from '@/lib/runtime/PortMessaging'
import { Logging } from '@/lib/utils/Logging'
import { ExecutionManager } from '@/lib/execution/ExecutionManager'
import { PubSub } from '@/lib/pubsub'

/**
 * Handles planning-related messages:
 * - GET_CURRENT_PLAN: Get the current execution plan
 * - UPDATE_PLAN: Modify the execution plan
 * - GET_PLAN_HISTORY: Get history of plan changes
 */
export class PlanHandler {
  private executionManager: ExecutionManager
  private planHistory: Map<string, Array<any>> = new Map()  // executionId -> plans

  constructor() {
    this.executionManager = ExecutionManager.getInstance()
  }

  /**
   * Handle GET_CURRENT_PLAN message
   */
  handleGetCurrentPlan(
    message: PortMessage,
    port: chrome.runtime.Port,
    executionId?: string
  ): void {
    try {
      const execId = executionId || 'default'
      const execution = this.executionManager.get(execId)
      
      if (!execution) {
        throw new Error(`No execution found with ID: ${execId}`)
      }
      
      // Get current plan from execution's message history or state
      const currentPlan = this.extractCurrentPlan(execution)
      
      port.postMessage({
        type: MessageType.WORKFLOW_STATUS,
        payload: { 
          status: 'success',
          data: { 
            plan: currentPlan,
            executionId: execId
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
    port: chrome.runtime.Port,
    executionId?: string
  ): void {
    try {
      const execId = executionId || 'default'
      const { plan } = message.payload as { plan: any }
      
      // Store plan in history
      if (!this.planHistory.has(execId)) {
        this.planHistory.set(execId, [])
      }
      this.planHistory.get(execId)!.push({
        plan,
        timestamp: Date.now(),
        source: 'manual_update'
      })
      
      // Publish plan update event via PubSub
      const channel = PubSub.getChannel(execId)
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
      
      Logging.log('PlanHandler', `Updated plan for execution ${execId}`)
      
      port.postMessage({
        type: MessageType.WORKFLOW_STATUS,
        payload: { 
          status: 'success',
          message: 'Plan updated',
          executionId: execId
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
    port: chrome.runtime.Port,
    executionId?: string
  ): void {
    try {
      const execId = executionId || 'default'
      const history = this.planHistory.get(execId) || []
      
      port.postMessage({
        type: MessageType.WORKFLOW_STATUS,
        payload: { 
          status: 'success',
          data: { 
            history,
            executionId: execId,
            count: history.length
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
   * Clear plan history for an execution
   */
  clearHistory(executionId: string): void {
    this.planHistory.delete(executionId)
    Logging.log('PlanHandler', `Cleared plan history for execution ${executionId}`)
  }

  /**
   * Get statistics
   */
  getStats(): any {
    const stats: any = {
      executionsWithPlans: this.planHistory.size,
      totalPlans: 0
    }
    
    for (const history of this.planHistory.values()) {
      stats.totalPlans += history.length
    }
    
    return stats
  }
}