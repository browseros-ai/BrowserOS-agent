/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * SwarmWorkerAgent - Worker agent for executing swarm tasks
 *
 * This agent runs in a worker window and executes assigned tasks
 * autonomously, reporting progress back to the master coordinator.
 */

import { EventEmitter } from 'node:events'
import { logger } from '../../lib/logger'
import type { SwarmMessagingBus } from '../messaging/swarm-bus'
import type { WorkerTask, SwarmMessage, SwarmMessageType } from '../types'

export type WorkerAgentState =
  | 'idle'
  | 'initializing'
  | 'executing'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'terminated'

export interface WorkerAgentConfig {
  /** Worker ID */
  workerId: string
  /** Swarm ID this worker belongs to */
  swarmId: string
  /** Heartbeat interval in ms */
  heartbeatIntervalMs: number
  /** Progress report interval in ms */
  progressReportIntervalMs: number
  /** Maximum retries for failed actions */
  maxActionRetries: number
  /** Enable verbose logging */
  verbose: boolean
}

export interface AgentAction {
  type: 'navigate' | 'click' | 'type' | 'scroll' | 'wait' | 'extract' | 'screenshot' | 'custom'
  target?: string
  value?: string
  options?: Record<string, unknown>
}

export interface AgentStep {
  action: AgentAction
  description: string
  expectedOutcome?: string
  validation?: (result: unknown) => boolean
}

export interface ExecutionPlan {
  steps: AgentStep[]
  fallbackSteps?: AgentStep[]
  maxDurationMs?: number
}

export interface ExecutionResult {
  success: boolean
  data?: unknown
  error?: string
  steps: {
    action: AgentAction
    success: boolean
    durationMs: number
    result?: unknown
    error?: string
  }[]
  metrics: {
    totalDurationMs: number
    actionsPerformed: number
    pagesVisited: number
    screenshotsTaken: number
  }
}

export interface BrowserController {
  navigate(url: string): Promise<void>
  click(selector: string): Promise<void>
  type(selector: string, text: string): Promise<void>
  scroll(direction: 'up' | 'down' | 'left' | 'right', amount?: number): Promise<void>
  waitForSelector(selector: string, timeoutMs?: number): Promise<void>
  waitForNavigation(timeoutMs?: number): Promise<void>
  extractText(selector: string): Promise<string>
  extractData(selectors: Record<string, string>): Promise<Record<string, string>>
  screenshot(): Promise<string> // Base64
  getCurrentUrl(): string
  getPageContent(): Promise<string>
  evaluate<T>(fn: string): Promise<T>
}

const DEFAULT_CONFIG: Omit<WorkerAgentConfig, 'workerId' | 'swarmId'> = {
  heartbeatIntervalMs: 5000,
  progressReportIntervalMs: 3000,
  maxActionRetries: 3,
  verbose: false,
}

export class SwarmWorkerAgent extends EventEmitter {
  private config: WorkerAgentConfig
  private state: WorkerAgentState = 'idle'
  private currentTask?: WorkerTask
  private executionPlan?: ExecutionPlan
  private progress = 0
  private currentStepIndex = 0
  private heartbeatInterval?: NodeJS.Timeout
  private progressInterval?: NodeJS.Timeout
  private startTime = 0
  private metrics = {
    actionsPerformed: 0,
    pagesVisited: 0,
    screenshotsTaken: 0,
  }

  constructor(
    private messageBus: SwarmMessagingBus,
    private browserController: BrowserController,
    private llmProvider: { generate: (prompt: string) => Promise<string> },
    config: Partial<WorkerAgentConfig> & { workerId: string; swarmId: string },
  ) {
    super()
    this.config = { ...DEFAULT_CONFIG, ...config }

    // Subscribe to messages from master
    this.setupMessageHandlers()
  }

  /**
   * Sets up message handlers for master communication.
   */
  private setupMessageHandlers(): void {
    this.messageBus.subscribe(
      this.config.swarmId,
      this.config.workerId,
      async (message) => {
        await this.handleMessage(message)
      },
    )

    // Also subscribe to broadcasts
    this.messageBus.subscribeBroadcast(this.config.swarmId, async (message) => {
      await this.handleMessage(message)
    })
  }

  /**
   * Handles incoming messages from master.
   */
  private async handleMessage(message: SwarmMessage): Promise<void> {
    logger.debug('Worker received message', {
      workerId: this.config.workerId,
      type: message.type,
    })

    switch (message.type) {
      case 'task_assign':
        await this.handleTaskAssign(message.payload as WorkerTask)
        break

      case 'terminate':
        await this.handleTerminate()
        break

      case 'coordination':
        // Handle coordination messages (e.g., pause, resume)
        const coordPayload = message.payload as { action: string }
        if (coordPayload.action === 'pause') {
          this.pause()
        } else if (coordPayload.action === 'resume') {
          this.resume()
        }
        break
    }
  }

  /**
   * Handles task assignment from master.
   */
  private async handleTaskAssign(task: WorkerTask): Promise<void> {
    if (this.state !== 'idle') {
      logger.warn('Worker received task while not idle', {
        workerId: this.config.workerId,
        currentState: this.state,
      })
      return
    }

    this.currentTask = task
    this.state = 'initializing'
    this.progress = 0
    this.currentStepIndex = 0
    this.startTime = Date.now()
    this.metrics = { actionsPerformed: 0, pagesVisited: 0, screenshotsTaken: 0 }

    logger.info('Worker starting task', {
      workerId: this.config.workerId,
      taskId: task.id,
      instruction: task.instruction.slice(0, 100),
    })

    // Start heartbeat
    this.startHeartbeat()

    try {
      // Navigate to start URL if provided
      if (task.startUrl) {
        await this.browserController.navigate(task.startUrl)
        this.metrics.pagesVisited++
      }

      // Generate execution plan using LLM
      this.executionPlan = await this.planExecution(task)

      // Execute the plan
      this.state = 'executing'
      const result = await this.executeplan()

      // Report completion
      this.state = 'completed'
      this.progress = 100

      this.sendToMaster('task_complete', {
        taskId: task.id,
        success: result.success,
        result: result.data,
        metrics: {
          durationMs: Date.now() - this.startTime,
          ...this.metrics,
        },
      })

      logger.info('Worker completed task', {
        workerId: this.config.workerId,
        taskId: task.id,
        success: result.success,
        durationMs: Date.now() - this.startTime,
      })
    } catch (error) {
      this.state = 'failed'

      this.sendToMaster('task_failed', {
        taskId: task.id,
        error: (error as Error).message,
        metrics: {
          durationMs: Date.now() - this.startTime,
          ...this.metrics,
        },
      })

      logger.error('Worker task failed', {
        workerId: this.config.workerId,
        taskId: task.id,
        error,
      })
    } finally {
      this.stopHeartbeat()
      this.cleanup()
    }
  }

  /**
   * Plans execution steps using LLM.
   */
  private async planExecution(task: WorkerTask): Promise<ExecutionPlan> {
    const currentUrl = this.browserController.getCurrentUrl()
    const pageContent = await this.browserController.getPageContent()

    const prompt = `You are an AI browser automation agent. Plan the steps to complete this task.

## Task
${task.instruction}

## Current State
- URL: ${currentUrl}
- Page Content (truncated): ${pageContent.slice(0, 2000)}

## Instructions
Break down the task into specific browser actions. For each step, specify:
1. The action type (navigate, click, type, scroll, wait, extract)
2. The target selector or URL
3. Any value needed (for typing)
4. Expected outcome

Return a JSON array of steps:
[
  {
    "action": { "type": "navigate", "value": "https://example.com" },
    "description": "Navigate to the target website",
    "expectedOutcome": "Page loads successfully"
  },
  {
    "action": { "type": "click", "target": "button.search" },
    "description": "Click the search button",
    "expectedOutcome": "Search modal opens"
  }
]

Return ONLY valid JSON.`

    const response = await this.llmProvider.generate(prompt)
    const steps = this.parseSteps(response)

    return { steps }
  }

  /**
   * Parses LLM response into steps.
   */
  private parseSteps(response: string): AgentStep[] {
    try {
      let cleaned = response.trim()
      if (cleaned.startsWith('```json')) {
        cleaned = cleaned.slice(7)
      }
      if (cleaned.startsWith('```')) {
        cleaned = cleaned.slice(3)
      }
      if (cleaned.endsWith('```')) {
        cleaned = cleaned.slice(0, -3)
      }

      const parsed = JSON.parse(cleaned.trim())
      return Array.isArray(parsed) ? parsed : []
    } catch (error) {
      logger.error('Failed to parse execution plan', { error, response })
      return []
    }
  }

  /**
   * Executes the planned steps.
   */
  private async executeplan(): Promise<ExecutionResult> {
    if (!this.executionPlan) {
      return {
        success: false,
        error: 'No execution plan',
        steps: [],
        metrics: { totalDurationMs: 0, actionsPerformed: 0, pagesVisited: 0, screenshotsTaken: 0 },
      }
    }

    const stepResults: ExecutionResult['steps'] = []
    let lastResult: unknown

    for (let i = 0; i < this.executionPlan.steps.length; i++) {
      if (this.state === 'paused') {
        await this.waitForResume()
      }

      if (this.state === 'terminated') {
        break
      }

      const step = this.executionPlan.steps[i]
      this.currentStepIndex = i
      this.progress = Math.floor(((i + 1) / this.executionPlan.steps.length) * 100)

      // Report progress
      this.reportProgress(step.description)

      const stepStart = Date.now()

      try {
        lastResult = await this.executeStep(step)
        stepResults.push({
          action: step.action,
          success: true,
          durationMs: Date.now() - stepStart,
          result: lastResult,
        })
        this.metrics.actionsPerformed++
      } catch (error) {
        stepResults.push({
          action: step.action,
          success: false,
          durationMs: Date.now() - stepStart,
          error: (error as Error).message,
        })

        // Check if we should continue or fail
        if (step.validation) {
          // Step has validation, this is critical
          return {
            success: false,
            error: `Step "${step.description}" failed: ${(error as Error).message}`,
            steps: stepResults,
            metrics: {
              totalDurationMs: Date.now() - this.startTime,
              ...this.metrics,
            },
          }
        }
        // Non-critical step, continue
      }
    }

    // Extract final result
    const finalData = await this.extractFinalResult()

    return {
      success: true,
      data: finalData,
      steps: stepResults,
      metrics: {
        totalDurationMs: Date.now() - this.startTime,
        ...this.metrics,
      },
    }
  }

  /**
   * Executes a single step.
   */
  private async executeStep(step: AgentStep): Promise<unknown> {
    const { action } = step

    switch (action.type) {
      case 'navigate':
        await this.browserController.navigate(action.value!)
        this.metrics.pagesVisited++
        return { navigated: action.value }

      case 'click':
        await this.browserController.click(action.target!)
        return { clicked: action.target }

      case 'type':
        await this.browserController.type(action.target!, action.value!)
        return { typed: action.value }

      case 'scroll':
        await this.browserController.scroll(
          (action.options?.direction as 'up' | 'down') ?? 'down',
        )
        return { scrolled: action.options?.direction ?? 'down' }

      case 'wait':
        if (action.target) {
          await this.browserController.waitForSelector(action.target)
        } else {
          await new Promise((r) => setTimeout(r, parseInt(action.value!) || 1000))
        }
        return { waited: action.target ?? action.value }

      case 'extract':
        if (action.target) {
          return await this.browserController.extractText(action.target)
        }
        return await this.browserController.getPageContent()

      case 'screenshot':
        const screenshot = await this.browserController.screenshot()
        this.metrics.screenshotsTaken++
        return { screenshot }

      case 'custom':
        if (action.value) {
          return await this.browserController.evaluate(action.value)
        }
        return null

      default:
        logger.warn('Unknown action type', { type: action.type })
        return null
    }
  }

  /**
   * Extracts the final result after execution.
   */
  private async extractFinalResult(): Promise<unknown> {
    const pageContent = await this.browserController.getPageContent()
    const currentUrl = this.browserController.getCurrentUrl()

    // Use LLM to extract relevant data
    const prompt = `Extract the relevant information from this page content to answer the original task.

## Original Task
${this.currentTask?.instruction}

## Current URL
${currentUrl}

## Page Content
${pageContent.slice(0, 4000)}

## Instructions
Extract and summarize the key information that answers the task. Return structured data if applicable, or a clear summary.

Return your answer as JSON or plain text.`

    const response = await this.llmProvider.generate(prompt)

    try {
      return JSON.parse(response)
    } catch {
      return response
    }
  }

  /**
   * Reports progress to master.
   */
  private reportProgress(currentAction?: string): void {
    this.sendToMaster('task_progress', {
      taskId: this.currentTask?.id,
      progress: this.progress,
      currentAction,
      stepIndex: this.currentStepIndex,
      totalSteps: this.executionPlan?.steps.length ?? 0,
    })
  }

  /**
   * Starts heartbeat reporting.
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      this.sendToMaster('heartbeat', {
        workerId: this.config.workerId,
        state: this.state,
        progress: this.progress,
        timestamp: Date.now(),
      })
    }, this.config.heartbeatIntervalMs)
  }

  /**
   * Stops heartbeat reporting.
   */
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = undefined
    }
  }

  /**
   * Sends a message to the master coordinator.
   */
  private sendToMaster(type: SwarmMessageType, payload: unknown): void {
    this.messageBus.sendToMaster(
      this.config.swarmId,
      this.config.workerId,
      type,
      payload,
    )
  }

  /**
   * Pauses execution.
   */
  pause(): void {
    if (this.state === 'executing') {
      this.state = 'paused'
      this.emit('paused')
    }
  }

  /**
   * Resumes execution.
   */
  resume(): void {
    if (this.state === 'paused') {
      this.state = 'executing'
      this.emit('resumed')
    }
  }

  /**
   * Waits for resume after pause.
   */
  private waitForResume(): Promise<void> {
    return new Promise((resolve) => {
      const check = () => {
        if (this.state !== 'paused') {
          resolve()
        } else {
          setTimeout(check, 100)
        }
      }
      check()
    })
  }

  /**
   * Handles termination request.
   */
  private async handleTerminate(): Promise<void> {
    logger.info('Worker terminating', { workerId: this.config.workerId })
    this.state = 'terminated'
    this.cleanup()
    this.emit('terminated')
  }

  /**
   * Cleans up resources.
   */
  private cleanup(): void {
    this.stopHeartbeat()
    if (this.progressInterval) {
      clearInterval(this.progressInterval)
    }
    this.currentTask = undefined
    this.executionPlan = undefined
  }

  /**
   * Gets current state.
   */
  getState(): WorkerAgentState {
    return this.state
  }

  /**
   * Gets current progress.
   */
  getProgress(): number {
    return this.progress
  }

  /**
   * Gets current task.
   */
  getCurrentTask(): WorkerTask | undefined {
    return this.currentTask
  }
}
