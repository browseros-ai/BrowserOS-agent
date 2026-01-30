/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * ResultAggregator - Merges worker results into unified output
 *
 * Handles aggregation of parallel worker results, including
 * partial results from failed workers.
 */

import { logger } from '../../lib/logger'
import type { SwarmRegistry } from './swarm-registry'
import type { SwarmResult, SwarmMetrics, Worker } from '../types'

export interface AggregatedResult {
  partial: boolean
  warnings: string[]
  result: unknown
  metrics: SwarmMetrics
}

export interface LLMSynthesizer {
  synthesize(
    task: string,
    results: Array<{ taskId: string; instruction: string; result: unknown }>,
    outputFormat: 'json' | 'markdown' | 'html',
  ): Promise<unknown>
}

export class ResultAggregator {
  constructor(
    private registry: SwarmRegistry,
    private synthesizer?: LLMSynthesizer,
  ) {}

  /**
   * Aggregates results from all workers in a swarm.
   */
  async aggregate(
    swarmId: string,
    outputFormat: 'json' | 'markdown' | 'html' = 'markdown',
  ): Promise<AggregatedResult> {
    const swarm = this.registry.getOrThrow(swarmId)
    const workers = this.registry.getWorkers(swarmId)

    const completed = workers.filter((w) => w.state === 'completed')
    const failed = workers.filter(
      (w) => w.state === 'failed' || w.state === 'terminated',
    )

    logger.info('Aggregating swarm results', {
      swarmId,
      completedWorkers: completed.length,
      failedWorkers: failed.length,
    })

    // Calculate metrics
    const metrics = this.calculateMetrics(workers, swarm.startedAt)

    // Handle all failed case
    if (completed.length === 0) {
      const errors = failed.map((w) => w.error ?? 'Unknown error').join('; ')
      throw new Error(`All workers failed: ${errors}`)
    }

    // Collect results
    const workerResults = completed.map((w) => ({
      taskId: w.task.id,
      instruction: w.task.instruction,
      result: w.result,
    }))

    // Generate warnings for failed workers
    const warnings = failed.map(
      (w) => `Task "${w.task.instruction.slice(0, 50)}..." failed: ${w.error ?? 'Unknown error'}`,
    )

    // Synthesize final result
    let finalResult: unknown

    if (this.synthesizer) {
      // Use LLM to synthesize results
      finalResult = await this.synthesizer.synthesize(
        swarm.task,
        workerResults,
        outputFormat,
      )
    } else {
      // Simple aggregation without LLM
      finalResult = this.simpleAggregate(workerResults, outputFormat)
    }

    return {
      partial: failed.length > 0,
      warnings,
      result: finalResult,
      metrics,
    }
  }

  /**
   * Calculates swarm execution metrics.
   */
  private calculateMetrics(
    workers: Worker[],
    startedAt?: number,
  ): SwarmMetrics {
    const completed = workers.filter((w) => w.state === 'completed')
    const failed = workers.filter(
      (w) => w.state === 'failed' || w.state === 'terminated',
    )

    const totalDurationMs = startedAt ? Date.now() - startedAt : 0

    const totalActionsPerformed = completed.reduce(
      (sum, w) => sum + (w.metrics?.actionsPerformed ?? 0),
      0,
    )

    return {
      totalDurationMs,
      workerCount: workers.length,
      successfulWorkers: completed.length,
      failedWorkers: failed.length,
      totalActionsPerformed,
    }
  }

  /**
   * Simple aggregation without LLM synthesis.
   */
  private simpleAggregate(
    results: Array<{ taskId: string; instruction: string; result: unknown }>,
    outputFormat: 'json' | 'markdown' | 'html',
  ): unknown {
    switch (outputFormat) {
      case 'json':
        return {
          results: results.map((r) => ({
            task: r.instruction,
            result: r.result,
          })),
        }

      case 'markdown':
        return this.formatAsMarkdown(results)

      case 'html':
        return this.formatAsHtml(results)

      default:
        return results
    }
  }

  /**
   * Formats results as Markdown.
   */
  private formatAsMarkdown(
    results: Array<{ taskId: string; instruction: string; result: unknown }>,
  ): string {
    const sections = results.map((r, index) => {
      const resultStr =
        typeof r.result === 'string'
          ? r.result
          : JSON.stringify(r.result, null, 2)

      return `## ${index + 1}. ${r.instruction}

${resultStr}
`
    })

    return `# Swarm Results

${sections.join('\n---\n\n')}
`
  }

  /**
   * Formats results as HTML.
   */
  private formatAsHtml(
    results: Array<{ taskId: string; instruction: string; result: unknown }>,
  ): string {
    const sections = results.map((r, index) => {
      const resultStr =
        typeof r.result === 'string'
          ? r.result
          : `<pre>${JSON.stringify(r.result, null, 2)}</pre>`

      return `
<section class="swarm-result">
  <h2>${index + 1}. ${this.escapeHtml(r.instruction)}</h2>
  <div class="result-content">${resultStr}</div>
</section>`
    })

    return `<!DOCTYPE html>
<html>
<head>
  <title>Swarm Results</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
    .swarm-result { margin-bottom: 2rem; padding-bottom: 2rem; border-bottom: 1px solid #eee; }
    h1 { color: #333; }
    h2 { color: #666; }
    pre { background: #f5f5f5; padding: 1rem; overflow-x: auto; }
  </style>
</head>
<body>
  <h1>Swarm Results</h1>
  ${sections.join('\n')}
</body>
</html>`
  }

  /**
   * Escapes HTML special characters.
   */
  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')
  }
}
