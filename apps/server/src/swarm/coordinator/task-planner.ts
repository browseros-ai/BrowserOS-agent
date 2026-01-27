/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * TaskPlanner - LLM-powered task decomposition
 *
 * Uses the LLM to decompose complex tasks into parallelizable subtasks
 * for swarm execution.
 */

import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { logger } from '../../lib/logger'
import { SWARM_LIMITS } from '../constants'
import type { WorkerTask } from '../types'

// Schema for LLM decomposition output - intentionally lenient to handle LLM quirks
const DecomposedTaskSchema = z.object({
  subtasks: z.array(
    z.object({
      instruction: z.string(),
      startUrl: z.string().url().optional().nullable(), // Allow null from LLM
      estimatedDurationMinutes: z.number().optional().nullable(),
      dependencies: z.array(z.string()).optional().nullable(),
    }),
  ),
  reasoning: z.string(),
  suggestedWorkerCount: z.number().int().min(0).max(10), // Allow 0 for non-parallelizable tasks
})

type DecomposedTask = z.infer<typeof DecomposedTaskSchema>

export interface DecompositionConfig {
  maxWorkers: number
  allowDependencies: boolean
  outputFormat: 'json' | 'markdown' | 'html'
}

export interface LLMProvider {
  generate(prompt: string): Promise<string>
}

const DECOMPOSITION_PROMPT = `You are a task decomposition expert. Your job is to break down complex tasks into independent subtasks that can be executed in parallel by separate browser automation agents.

## Task to decompose:
{task}

## Configuration:
- Maximum workers available: {maxWorkers}
- Allow dependencies between subtasks: {allowDependencies}
- Output format requested: {outputFormat}

## Instructions:
1. Analyze the task and identify independent units of work
2. Each subtask should be executable by a single browser agent
3. Subtasks should be as parallel as possible (minimize dependencies)
4. Each subtask should have a clear, actionable instruction
5. Include starting URLs when obvious (e.g., for research tasks)
6. Estimate duration for each subtask

## Output Format:
Return a JSON object with this structure:
{
  "subtasks": [
    {
      "instruction": "Clear instruction for the worker",
      "startUrl": "https://example.com (optional)",
      "estimatedDurationMinutes": 5,
      "dependencies": ["subtask-id-if-depends-on-another"]
    }
  ],
  "reasoning": "Explain your decomposition strategy",
  "suggestedWorkerCount": 3
}

Return ONLY valid JSON, no markdown code blocks.`

export class TaskPlanner {
  constructor(private llmProvider: LLMProvider) {}

  /**
   * Decomposes a complex task into parallelizable subtasks.
   */
  async decompose(
    task: string,
    config: DecompositionConfig,
  ): Promise<WorkerTask[]> {
    logger.info('Decomposing task', {
      task: task.slice(0, 100),
      maxWorkers: config.maxWorkers,
    })

    const prompt = this.buildPrompt(task, config)

    try {
      const response = await this.llmProvider.generate(prompt)
      const decomposed = this.parseResponse(response)

      // Convert to WorkerTasks (convert null to undefined for type safety)
      const workerTasks = decomposed.subtasks.map((subtask, index) => ({
        id: `task-${index + 1}-${randomUUID().slice(0, 8)}`,
        instruction: subtask.instruction,
        startUrl: subtask.startUrl ?? undefined,
        timeoutMs: subtask.estimatedDurationMinutes
          ? subtask.estimatedDurationMinutes * 60 * 1000
          : undefined,
        dependencies: subtask.dependencies ?? undefined,
      }))

      // Limit to maxWorkers
      const limitedTasks = workerTasks.slice(0, config.maxWorkers)

      logger.info('Task decomposed', {
        originalTask: task.slice(0, 100),
        subtaskCount: limitedTasks.length,
        reasoning: decomposed.reasoning.slice(0, 200),
      })

      return limitedTasks
    } catch (error) {
      logger.error('Failed to decompose task', { task, error })
      throw new Error(
        `Task decomposition failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      )
    }
  }

  /**
   * Estimates optimal worker count for a task.
   */
  async estimateWorkerCount(task: string): Promise<number> {
    const prompt = `Analyze this task and estimate how many parallel browser agents would be optimal for execution. Consider:
1. Independent units of work
2. Data dependencies
3. Diminishing returns with more workers

Task: ${task}

Return ONLY a number between 1 and ${SWARM_LIMITS.MAX_WORKERS}.`

    try {
      const response = await this.llmProvider.generate(prompt)
      const count = parseInt(response.trim(), 10)

      if (
        Number.isNaN(count) ||
        count < 1 ||
        count > SWARM_LIMITS.MAX_WORKERS
      ) {
        return SWARM_LIMITS.DEFAULT_WORKERS
      }

      return count
    } catch {
      return SWARM_LIMITS.DEFAULT_WORKERS
    }
  }

  /**
   * Builds the decomposition prompt.
   */
  private buildPrompt(task: string, config: DecompositionConfig): string {
    return DECOMPOSITION_PROMPT.replace('{task}', task)
      .replace('{maxWorkers}', config.maxWorkers.toString())
      .replace('{allowDependencies}', config.allowDependencies.toString())
      .replace('{outputFormat}', config.outputFormat)
  }

  /**
   * Parses the LLM response into structured data.
   */
  private parseResponse(response: string): DecomposedTask {
    // Clean up response (remove markdown code blocks if present)
    let cleaned = response.trim()

    // Handle various markdown code block formats
    const jsonBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (jsonBlockMatch) {
      cleaned = jsonBlockMatch[1].trim()
    } else {
      // Fallback: remove leading/trailing code block markers
      if (cleaned.startsWith('```json')) {
        cleaned = cleaned.slice(7)
      }
      if (cleaned.startsWith('```')) {
        cleaned = cleaned.slice(3)
      }
      if (cleaned.endsWith('```')) {
        cleaned = cleaned.slice(0, -3)
      }
    }

    try {
      const parsed = JSON.parse(cleaned.trim())

      // Normalize the parsed data before validation
      if (parsed.subtasks) {
        parsed.subtasks = parsed.subtasks.map(
          (task: Record<string, unknown>) => ({
            ...task,
            // Convert null to undefined for optional fields
            startUrl: task.startUrl || undefined,
            estimatedDurationMinutes:
              task.estimatedDurationMinutes ?? undefined,
            dependencies: task.dependencies ?? undefined,
          }),
        )
      }

      // Ensure suggestedWorkerCount is at least 1
      if (parsed.suggestedWorkerCount < 1) {
        parsed.suggestedWorkerCount = 1
      }

      return DecomposedTaskSchema.parse(parsed)
    } catch (error) {
      logger.error('Failed to parse decomposition response', {
        response: response.slice(0, 500),
        error,
      })
      throw new Error('Invalid decomposition response from LLM')
    }
  }

  /**
   * Creates a simple decomposition without LLM (fallback).
   */
  createManualTasks(
    tasks: Array<{ instruction: string; startUrl?: string }>,
  ): WorkerTask[] {
    return tasks.map((t, index) => ({
      id: `task-${index + 1}-${randomUUID().slice(0, 8)}`,
      instruction: t.instruction,
      startUrl: t.startUrl,
    }))
  }
}
