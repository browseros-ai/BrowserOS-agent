/**
 * EventEnricher - Adds contextual information to telemetry events
 * 
 * This class enriches telemetry events with additional context like:
 * - Conversation history
 * - Current plan state
 * - Browser state
 * - Task complexity
 * 
 * All enrichment is done lazily and only when telemetry is enabled
 */

import { z } from 'zod'
import { ExecutionContext } from '@/lib/runtime/ExecutionContext'
import { BaseMessage } from '@langchain/core/messages'

// Schema for enriched context that gets added to events
export const EnrichedContextSchema = z.object({
  // Conversation context
  conversationTurn: z.number().optional(),  // Which turn in the conversation
  messageHistoryLength: z.number().optional(),  // Total messages in history
  recentMessages: z.array(z.object({
    type: z.string(),
    content: z.string()  // Truncated to ~3 lines (150 chars) to reduce noise
  })).optional(),  // Last 3-5 messages
  
  // Planning context
  currentPlan: z.object({
    steps: z.array(z.string()),  // Plan steps
    currentStepIndex: z.number(),  // Which step we're on
    planId: z.string(),  // Unique plan identifier
    isReplanning: z.boolean()  // Whether this is a re-plan
  }).optional(),
  
  // Task context
  originalUserIntent: z.string().optional(),  // What user originally asked
  currentGoal: z.string().optional(),  // Current sub-goal being worked on
  taskComplexity: z.enum(['simple', 'complex']).optional(),  // Task classification
  
  // Tool selection context
  toolSelectionReason: z.string().optional(),  // Why this tool was chosen
  alternativeToolsConsidered: z.array(z.string()).optional(),  // Other tools considered
  confidenceScore: z.number().optional(),  // Confidence in tool choice
  
  // Browser state (lightweight)
  pageUrl: z.string().optional(),  // Current page URL
  pageTitle: z.string().optional(),  // Current page title
  browserTabCount: z.number().optional(),  // Number of open tabs
  activeTabId: z.string().optional()  // Currently active tab
})

export type EnrichedContext = z.infer<typeof EnrichedContextSchema>

/**
 * Enriches telemetry events with contextual information
 */
export class EventEnricher {
  private executionContext: ExecutionContext
  
  constructor(executionContext: ExecutionContext) {
    this.executionContext = executionContext
  }
  
  /**
   * Enrich an event with conversation context
   * Only adds what's available - doesn't fail if some data missing
   */
  async enrichWithConversationContext(): Promise<Partial<EnrichedContext>> {
    const context: Partial<EnrichedContext> = {}
    
    try {
      // Get conversation history
      const messages = this.executionContext.messageManager.getMessages()
      context.messageHistoryLength = messages.length
      
      // Calculate actual user conversation turns (not agent's internal instructions)
      // We track the current task number from ExecutionContext
      const currentTaskNumber = this.executionContext.getCurrentTaskNumber() || 1
      context.conversationTurn = currentTaskNumber
      
      // Get recent messages (last 3-5)
      context.recentMessages = this._getRecentMessages(messages, 3)
      
      // Get original user intent (first human message)
      const humanMessages = messages.filter(m => m._getType() === 'human')
      if (humanMessages.length > 0) {
        const firstMessage = humanMessages[0].content
        context.originalUserIntent = typeof firstMessage === 'string' 
          ? firstMessage 
          : JSON.stringify(firstMessage)
      }
    } catch (error) {
      // Silently ignore enrichment errors
    }
    
    return context
  }
  
  /**
   * Enrich with current plan information
   */
  async enrichWithPlanContext(): Promise<Partial<EnrichedContext>> {
    const context: Partial<EnrichedContext> = {}
    
    try {
      // Get TODO store to check for active plan
      const todoStore = this.executionContext.todoStore
      if (todoStore) {
        const todos = todoStore.getAll()
        if (todos.length > 0) {
          // Extract full plan with content
          const planSteps = todos.map((t: any) => t.content)
          const inProgressIndex = todos.findIndex((t: any) => t.status === 'in_progress')
          const completedCount = todos.filter((t: any) => t.status === 'completed').length
          
          context.currentPlan = {
            steps: planSteps.slice(0, 5),  // First 5 steps with full content
            currentStepIndex: inProgressIndex >= 0 ? inProgressIndex : completedCount,
            planId: `plan_${Date.now()}`,  // Simple plan ID
            isReplanning: completedCount > 0 && inProgressIndex >= 0  // Has completed + new in progress
          }
        }
      }
    } catch (error) {
      // Silently ignore enrichment errors
    }
    
    return context
  }
  
  /**
   * Enrich with browser state (lightweight)
   */
  async enrichWithBrowserState(): Promise<Partial<EnrichedContext>> {
    const context: Partial<EnrichedContext> = {}
    
    try {
      const browserContext = this.executionContext.browserContext
      if (browserContext) {
        // Get current page info from active tab
        const currentPage = await browserContext.getCurrentPage()
        if (currentPage) {
          const pageUrl = await currentPage.url()
          const pageTitle = await currentPage.title()
          
          context.pageUrl = this._sanitizeUrl(pageUrl)
          context.pageTitle = pageTitle
          
          // Get active tab ID from current page
          if (currentPage.tabId) {
            context.activeTabId = String(currentPage.tabId)
          }
        }
        
        // Get tab count
        const pages = await browserContext.getPages()
        context.browserTabCount = pages.length
      }
    } catch (error) {
      // Silently ignore enrichment errors
    }
    
    return context
  }
  
  /**
   * Enrich with task complexity
   */
  enrichWithTaskComplexity(complexity: 'simple' | 'complex'): Partial<EnrichedContext> {
    return {
      taskComplexity: complexity
    }
  }
  
  /**
   * Enrich with tool selection context
   */
  enrichWithToolSelection(
    reason?: string,
    alternatives?: string[],
    confidence?: number
  ): Partial<EnrichedContext> {
    const context: Partial<EnrichedContext> = {}
    
    if (reason) {
      context.toolSelectionReason = reason  // Full reason for dev telemetry
    }
    
    if (alternatives && alternatives.length > 0) {
      context.alternativeToolsConsidered = alternatives.slice(0, 5)  // Max 5 alternatives
    }
    
    if (confidence !== undefined) {
      context.confidenceScore = Math.min(1, Math.max(0, confidence))  // Clamp 0-1
    }
    
    return context
  }
  
  /**
   * Get a full enriched context combining all sources
   */
  async getFullContext(): Promise<EnrichedContext> {
    const [conversationContext, planContext, browserState] = await Promise.all([
      this.enrichWithConversationContext(),
      this.enrichWithPlanContext(),
      this.enrichWithBrowserState()
    ])
    
    return {
      ...conversationContext,
      ...planContext,
      ...browserState
    } as EnrichedContext
  }
  
  // Helper methods
  
  private _getRecentMessages(messages: BaseMessage[], count: number): any[] {
    const recent = messages.slice(-count)
    return recent.map(msg => ({
      type: msg._getType(),
      content: this._truncateContent(
        typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
        150  // Approximately 3 lines worth of characters
      )
    }))
  }
  
  private _truncateContent(content: string, maxLength: number = 150): string {
    if (content.length <= maxLength) {
      return content
    }
    
    // Try to truncate at a word boundary
    const truncated = content.substring(0, maxLength)
    const lastSpace = truncated.lastIndexOf(' ')
    
    if (lastSpace > maxLength * 0.8) {  // If we found a space in the last 20%
      return truncated.substring(0, lastSpace) + '...'
    }
    
    return truncated + '...'
  }
  
  private _sanitizeUrl(url: string): string {
    // For dev telemetry, just return the full URL
    return url
  }
}
