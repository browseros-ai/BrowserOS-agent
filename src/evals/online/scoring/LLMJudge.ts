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
  
  constructor() {
    this.model = DEFAULT_MODEL
    
    // Check if scoring is available
    const apiKey = OPENAI_API_KEY_FOR_SCORING
    this.enabled = !!(apiKey && apiKey.trim() && scoringOpenAI.chat)
    
    if (this.enabled) {
      console.log('%c✓ LLM Judge ready (multi-dimensional scoring)', 'color: #9c27b0; font-size: 10px')
    }
  }
  
  /**
   * Build full context from ExecutionContext for scoring
   * Only pulls data from single sources of truth - no re-extraction
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
    
    // Structure for the scoring prompt - using data directly from stores
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
      
      // Debug: Log context summary
      console.log('%c📋 Scoring Context Summary:', 'color: #9c27b0; font-weight: bold; font-size: 10px')
      console.log(`  Messages: ${fullContext.fullConversation?.length || 0}`)
      console.log(`  TODOs: ${fullContext.allTodos?.length || 0} (completed: ${fullContext.allTodos?.filter((t: any) => t.status === 'done').length || 0})`)
      console.log(`  Task: "${fullContext.eventData?.task || 'N/A'}"`)
      console.log(`  Outcome: ${fullContext.eventData?.phase || 'N/A'} (success: ${fullContext.eventData?.success})`)
      console.log(`  Duration: ${fullContext.eventData?.duration_ms || 0}ms`)
      console.log(`  Current URL: ${fullContext.pageUrl || 'N/A'}`)
      
      // Build multi-dimensional scoring prompt with full context
      const prompt = getMultiDimensionalScoringPrompt(userTask, fullContext)
      
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
        temperature: 0,  // Deterministic scoring
        max_tokens: 150,  // Enough for JSON response
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
      console.log('%c📊 Multi-Dimensional LLM Scores (Full Context):', 'color: #9c27b0; font-weight: bold; font-size: 11px')
      
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