/**
 * LLMJudge - Multi-dimensional LLM-based quality scoring for task executions (DEV ONLY)
 * 
 * Uses raw OpenAI SDK wrapped by Braintrust for first-class telemetry.
 * This is for development evaluation only - not production code.
 */

import { ExecutionContext } from '@/lib/runtime/ExecutionContext'
import { OPENAI_API_KEY_FOR_SCORING } from '@/config'
import { getMultiDimensionalScoringPrompt } from './LLMJudge.prompts'
import { scoringOpenAI, DEFAULT_MODEL } from './scoring-openai'
import { ToolMessage } from '@langchain/core/messages'

// Score dimension keys used in holistic scoring
const SCORE_DIMENSIONS = {
  GOAL_ACHIEVEMENT: 'goal_achievement',      // How well the user's goal was achieved (0-1)
  EXECUTION_QUALITY: 'execution_quality',    // Quality of execution steps and decisions (0-1)
  EXECUTION_PRECISION: 'execution_precision', // Precision of actions (no unnecessary retries) (0-1)
  PROGRESS_MADE: 'progress_made',            // Amount of progress toward goal (0-1)
  PLAN_COHERENCE: 'plan_coherence',          // Quality and logic of the plan (0-1)
  ERROR_HANDLING: 'error_handling'           // How well errors/issues were handled (0-1)
} as const

// Default fallback score when scoring fails
// -1.0 is used to distinguish from valid scores (0-1) in Braintrust
const FALLBACK_SCORE = -1.0

// Holistic scoring dimensions with weights for weighted average calculation
const HOLISTIC_SCORE_WEIGHTS = {
  [SCORE_DIMENSIONS.GOAL_ACHIEVEMENT]: 0.40,      // 40% - Most important: did we achieve the goal?
  [SCORE_DIMENSIONS.EXECUTION_QUALITY]: 0.20,     // 20% - How well was it executed?
  [SCORE_DIMENSIONS.EXECUTION_PRECISION]: 0.15,   // 15% - Were actions precise without retries?
  [SCORE_DIMENSIONS.PROGRESS_MADE]: 0.10,         // 10% - How much progress was made?
  [SCORE_DIMENSIONS.PLAN_COHERENCE]: 0.08,        // 8% - Was the plan logical?
  [SCORE_DIMENSIONS.ERROR_HANDLING]: 0.07         // 7% - How were errors handled?
} as const

// Format score for display
function formatScore(score: number): string {
  if (score === FALLBACK_SCORE) return 'N/A'
  return score.toFixed(2)
}

// Get score color for console logging
function getScoreColor(score: number): string {
  if (score === FALLBACK_SCORE) return '#888'  // Gray for N/A
  if (score >= 0.8) return '#00ff00'  // Green for good
  if (score >= 0.5) return '#ffaa00'  // Yellow for okay
  return '#ff0000'  // Red for poor
}

// Calculate weighted average of scores
function calculateWeightedAverage(scores: Record<string, number>): number {
  let weightedSum = 0
  let totalWeight = 0
  
  for (const [dimension, weight] of Object.entries(HOLISTIC_SCORE_WEIGHTS)) {
    // Skip N/A scores (-1) and missing scores
    if (dimension in scores && scores[dimension] >= 0) {
      weightedSum += scores[dimension] * weight
      totalWeight += weight
    }
  }
  
  // Return weighted average or fallback if no valid scores
  return totalWeight > 0 ? weightedSum / totalWeight : FALLBACK_SCORE
}

export type JudgeResult = { 
  score: number  // Legacy single score for backward compatibility
  scores?: Record<string, number>  // Multiple dimension scores
  scoringDetails?: any 
}

export type MultiDimensionalScores = {
  goal_achievement: number
  execution_quality: number
  execution_precision: number  // Tracks precision without unnecessary retries
  progress_made: number
  plan_coherence: number
  error_handling: number
  weighted_total?: number
}

export class LLMJudge {
  private enabled: boolean = false
  private model: string
  private isV2Experiment: boolean = false
  
  constructor(options?: { isV2Experiment?: boolean }) {
    this.model = DEFAULT_MODEL
    this.isV2Experiment = options?.isV2Experiment || false
    
    // Check if scoring is available
    const apiKey = OPENAI_API_KEY_FOR_SCORING
    this.enabled = !!(apiKey && apiKey.trim() && scoringOpenAI.chat)
    
    if (this.enabled) {
      const color = this.isV2Experiment ? '#6a1b9a' : '#9c27b0'  // Darker purple for v2, regular purple for v1
      const label = this.isV2Experiment ? '✓ LLM Judge ready (v2 experiment scoring)' : '✓ LLM Judge ready (multi-dimensional scoring)'
      console.log(`%c${label}`, `color: ${color}; font-size: 10px`)
    }
  }
  
  /**
   * Build full context from ExecutionContext for scoring
   * Extracts all available context from existing stores and message history
   * @param context - The execution context with all stores
   * @param taskOutcome - Minimal task outcome data from NxtScape (just status/duration)
   */
  private async buildFullContext(
    context: ExecutionContext,
    taskOutcome?: {
      outcome: 'success' | 'error' | 'paused',
      duration_ms: number
    }
  ): Promise<any> {
    // Direct access to MessageManager - single source of truth for conversation
    const messages = context.messageManager.getMessages()
    
    // Direct access to TodoStore - single source of truth for task plan
    const todos = context.todoStore.getAll()
    const currentDoing = context.todoStore.getCurrentDoing()
    
    // Direct access to BrowserContext - single source of truth for browser state
    let pageUrl = 'N/A'
    let pageTitle = 'N/A'
    try {
      const currentPage = await context.browserContext.getCurrentPage()
      if (currentPage) {
        pageUrl = await currentPage.url()
        pageTitle = await currentPage.title()
      }
    } catch (e) {
      // Browser state might not be available
    }
    
    // Extract tool execution details from messages
    const toolExecutions: any[] = []
    messages.forEach((msg, index) => {
      if (msg._getType() === 'tool') {
        const toolMsg = msg as ToolMessage
        // Look for the AI message before this tool message to get the tool call details
        if (index > 0 && messages[index - 1]._getType() === 'ai') {
          const aiMsg = messages[index - 1] as any
          if (aiMsg.tool_calls && aiMsg.tool_calls.length > 0) {
            // Find matching tool call by ID
            const toolCall = aiMsg.tool_calls.find((tc: any) => tc.id === toolMsg.tool_call_id)
            if (toolCall) {
              let parsedResult = null
              try {
                parsedResult = JSON.parse(toolMsg.content as string)
              } catch (e) {
                parsedResult = { output: toolMsg.content }
              }
              
              toolExecutions.push({
                name: toolCall.name,
                args: toolCall.args,
                result: parsedResult,
                success: parsedResult?.ok === true,
                error: parsedResult?.error || parsedResult?.output
              })
            }
          }
        }
      }
    })
    
    // Count tool retries (same tool called multiple times in succession)
    const toolRetries: Record<string, number> = {}
    let lastToolName = ''
    toolExecutions.forEach(exec => {
      if (exec.name === lastToolName && !exec.success) {
        toolRetries[exec.name] = (toolRetries[exec.name] || 0) + 1
      }
      lastToolName = exec.name
    })
    
    // Extract browser state changes from browser_state messages
    const browserStates: any[] = []
    messages.forEach(msg => {
      if (msg.additional_kwargs?.messageType === 'browser_state') {
        const content = msg.content as string
        // Extract URL from browser state content if available
        const urlMatch = content.match(/URL: ([^\n]+)/)
        const titleMatch = content.match(/Title: ([^\n]+)/)
        if (urlMatch || titleMatch) {
          browserStates.push({
            url: urlMatch ? urlMatch[1] : 'N/A',
            title: titleMatch ? titleMatch[1] : 'N/A',
            content: content
          })
        }
      }
    })
    

    
    // Structure for the scoring prompt - now with FULL context
    return {
      // Task outcome info (minimal, from NxtScape)
      eventData: {
        task: context.getCurrentTask(),
        taskNumber: context.getCurrentTaskNumber(),
        success: taskOutcome?.outcome === 'success',
        duration_ms: taskOutcome?.duration_ms || 0,
        phase: taskOutcome?.outcome === 'error' ? 'task_error' : 
               taskOutcome?.outcome === 'paused' ? 'task_paused' : 
               'task_complete'
      },
      
      // TodoStore data - direct reference
      currentPlan: todos.length > 0 ? {
        steps: todos.map(t => t.content),
        currentStepIndex: currentDoing ? todos.findIndex(t => t.id === currentDoing.id) : 
                          todos.filter(t => t.status === 'done').length,
        planId: `plan_${context.getCurrentTaskNumber()}`,
        isReplanning: false
      } : null,
      
      // MessageManager data - last 5 for prompt context
      recentMessages: messages.slice(-5).map(msg => ({
        type: msg._getType(),
        content: msg.content
      })),
      
      // BrowserContext data - current state
      pageUrl,
      pageTitle,
      
      // Full execution context with complete, untruncated data
      toolExecutions,         // All tool calls with full args and results
      browserStates,         // Browser state changes over time
      toolRetries,          // Count of tool retry attempts
      
      // Stats for scoring
      totalToolCalls: toolExecutions.length,
      failedToolCalls: toolExecutions.filter(e => !e.success).length,
      uniqueToolsUsed: new Set(toolExecutions.map(e => e.name)).size,
      
      // Additional direct references (for scoring logic if needed)
      fullConversation: messages,  // Direct reference, no copying
      allTodos: todos,  // Direct reference, no copying
      tokenCount: context.messageManager.getTokenCount()
    }
  }

  /**
   * Score task completion using full ExecutionContext
   * New method that accesses complete data directly from stores
   * @param userTask - The original user request
   * @param executionContext - Full execution context with all stores
   * @param taskOutcome - Minimal task outcome data (just status and duration)
   */
  async scoreTaskCompletionWithContext(
    userTask: string,
    executionContext: ExecutionContext,
    taskOutcome?: {
      outcome: 'success' | 'error' | 'paused',
      duration_ms: number
    }
  ): Promise<JudgeResult> {
    // Skip if not enabled
    if (!this.enabled || !scoringOpenAI.chat) {
      console.log('%c⚠ Skipping scoring (not enabled)', 'color: #888; font-size: 10px')
      return { score: FALLBACK_SCORE }
    }
    
    try {
      // Build full context from ExecutionContext with task outcome
      const fullContext = await this.buildFullContext(executionContext, taskOutcome)
      
      // Build multi-dimensional scoring prompt with full context
      // NOTE: We provide complete, untruncated data for accurate scoring
      const prompt = getMultiDimensionalScoringPrompt(userTask, fullContext)
      
      // Log scoring context and prompt in a collapsible group (for debugging)
      // Always show but collapsed by default for minimal intrusion
      const summaryColor = this.isV2Experiment ? '#6a1b9a' : '#9c27b0'  // Darker purple for v2, regular purple for v1
      const summaryLabel = this.isV2Experiment ? '📋 LLM Scorer Context Summary - V2 Experiment (click to expand/collapse)' : '📋 LLM Scorer Context Summary (click to expand/collapse)'
      console.groupCollapsed(`%c${summaryLabel}`, `color: ${summaryColor}; font-weight: bold; font-size: 11px`)
        
        // Context summary
        console.log('%c📊 Execution Summary:', 'color: #666; font-weight: bold')
        console.log(`  Task: "${fullContext.eventData?.task || 'N/A'}"`)
        console.log(`  Outcome: ${fullContext.eventData?.phase || 'N/A'} (success: ${fullContext.eventData?.success})`)
        console.log(`  Duration: ${fullContext.eventData?.duration_ms || 0}ms`)
        console.log(`  Current URL: ${fullContext.pageUrl || 'N/A'}`)
        console.log('')
        
        console.log('%c📈 Execution Metrics:', 'color: #666; font-weight: bold')
        console.log(`  Messages: ${fullContext.fullConversation?.length || 0}`)
        console.log(`  TODOs: ${fullContext.allTodos?.length || 0} (completed: ${fullContext.allTodos?.filter((t: any) => t.status === 'done').length || 0})`)
        console.log(`  Tool Executions: ${fullContext.totalToolCalls || 0} (failed: ${fullContext.failedToolCalls || 0})`)
        console.log(`  Unique Tools: ${fullContext.uniqueToolsUsed || 0}`)
        console.log(`  Browser States: ${fullContext.browserStates?.length || 0}`)
        console.log(`  Tool Retries: ${Object.keys(fullContext.toolRetries || {}).length} tools with retries`)
        console.log('')
        
        console.log('%c🔧 Tool Statistics:', 'color: #666; font-weight: bold')
        console.log(`  Total Tool Calls: ${fullContext.totalToolCalls || 0}`)
        console.log(`  Failed Tool Calls: ${fullContext.failedToolCalls || 0}`)
        console.log(`  Unique Tools Used: ${fullContext.uniqueToolsUsed || 0}`)
        console.log(`  Tools with Retries: ${Object.keys(fullContext.toolRetries || {}).length}`)
        console.log('')
        
        // Prompt stats
        console.log('%c📝 Prompt Statistics:', 'color: #666; font-weight: bold')
        console.log(`  Character count: ${prompt.length.toLocaleString()}`)
        console.log(`  Line count: ${prompt.split('\n').length.toLocaleString()}`)
        console.log(`  Estimated tokens: ~${Math.ceil(prompt.length / 4).toLocaleString()}`)
        console.log('')
        
        // Log the full prompt (will be collapsed by default)
        console.log('%c📄 Full Prompt Content:', 'color: #666; font-weight: bold')
        console.log(prompt)
        
      console.groupEnd()
      
      // Use wrapped OpenAI for automatic Braintrust telemetry
      const completion = await scoringOpenAI.chat.completions.create({
        model: this.model,
        messages: [
          { 
            role: 'system', 
            content: 'You are a strict evaluator. Return ONLY a valid JSON object with the exact keys specified.' 
          },
          { 
            role: 'user', 
            content: prompt 
          }
        ],
        // temperature: 0,  // GPT-5 only supports default temperature (1)
        max_completion_tokens: 3000,  // Generous limit for thorough scoring with GPT-5
        response_format: { type: 'json_object' }  // Force JSON response
      })
      
      const content = completion.choices?.[0]?.message?.content || '{}'
      let dimensionScores: MultiDimensionalScores
      
      try {
        // Parse the JSON response
        dimensionScores = JSON.parse(content)
        
        // Validate all expected dimensions are present
        const expectedDimensions = Object.keys(HOLISTIC_SCORE_WEIGHTS)
        for (const dimension of expectedDimensions) {
          const scoreValue = dimensionScores[dimension as keyof MultiDimensionalScores]
          if (scoreValue === undefined || 
              typeof scoreValue !== 'number' ||
              scoreValue < 0 || 
              scoreValue > 1) {
            console.warn(`Invalid or missing score for ${dimension}`)
            dimensionScores[dimension as keyof MultiDimensionalScores] = 0.5  // Default middle score
          }
        }
      } catch (parseError) {
        console.warn(`Failed to parse LLM scoring response: ${content}`)
        return { 
          score: FALLBACK_SCORE,
          scoringDetails: {
            response: content,
            error: 'Invalid JSON format'
          }
        }
      }
      
      // Calculate weighted average
      const weightedTotal = calculateWeightedAverage(dimensionScores)
      dimensionScores.weighted_total = weightedTotal
      
      // Log detailed scores to console
      const scoresColor = this.isV2Experiment ? '#6a1b9a' : '#9c27b0'  // Darker purple for v2, regular purple for v1
      const scoresLabel = this.isV2Experiment ? '📊 Multi-Dimensional LLM Scores - V2 Experiment (Full Context):' : '📊 Multi-Dimensional LLM Scores (Full Context):'
      console.log(`%c${scoresLabel}`, `color: ${scoresColor}; font-weight: bold; font-size: 11px`)
      
      // Log individual dimensions
      for (const [dimension, score] of Object.entries(dimensionScores)) {
        if (dimension === 'weighted_total') continue
        const weight = HOLISTIC_SCORE_WEIGHTS[dimension as keyof typeof HOLISTIC_SCORE_WEIGHTS]
        const displayName = dimension.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
        console.log(
          `%c  ${displayName}: ${formatScore(score)} ${weight ? `(weight: ${weight * 100}%)` : ''}`,
          `color: ${getScoreColor(score)}; font-size: 10px`
        )
      }
      
      // Log weighted total with emphasis
      console.log(
        `%c  → Weighted Total: ${formatScore(weightedTotal)}`,
        `color: ${getScoreColor(weightedTotal)}; font-weight: bold; font-size: 11px`
      )
      
      // Include context summary in scoring details
      const scoringDetails = {
        response: content,
        parsedScores: dimensionScores,
        usage: completion.usage,
        weights: HOLISTIC_SCORE_WEIGHTS,
        model: this.model,
        timestamp: new Date().toISOString(),
        contextSummary: {
          messageCount: fullContext.fullConversation?.length || 0,
          todoCount: fullContext.allTodos?.length || 0,
          todosCompleted: fullContext.allTodos?.filter((t: any) => t.status === 'done').length || 0,
          tokenCount: fullContext.tokenCount || 0
        }
      }
      
      return {
        score: weightedTotal,  // For backward compatibility
        scores: dimensionScores,  // All dimension scores including weighted_total
        scoringDetails
      }
    } catch (error) {
      // Don't let scoring errors break execution
      console.warn(`LLMJudge scoring with context failed:`, error)
      return { 
        score: FALLBACK_SCORE,
        scoringDetails: {
          error: error instanceof Error ? error.message : String(error)
        }
      }
    }
  }


}