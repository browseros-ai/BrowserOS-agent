/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * StreamingAggregator - Real-time result streaming and aggregation
 *
 * Provides live streaming of worker results with progressive
 * aggregation and conflict resolution.
 */

import { EventEmitter } from 'node:events'
import { logger } from '../../lib/logger'
import type { SwarmRegistry } from '../coordinator/swarm-registry'
import type { SwarmMetrics, Worker, WorkerTask } from '../types'

export type AggregationMode = 'merge' | 'concat' | 'vote' | 'custom'

export interface StreamingConfig {
  /** How to combine results */
  mode: AggregationMode
  /** Enable real-time streaming updates */
  enableStreaming: boolean
  /** Emit partial results as they arrive */
  emitPartials: boolean
  /** Minimum confidence for voting mode */
  minVoteConfidence: number
  /** Custom merge function */
  customMerge?: (results: WorkerResult[]) => unknown
  /** Conflict resolution strategy */
  conflictResolution: 'first' | 'last' | 'majority' | 'highest-confidence'
}

export interface WorkerResult {
  workerId: string
  taskId: string
  instruction: string
  result: unknown
  confidence?: number
  metadata?: Record<string, unknown>
  completedAt: number
  durationMs: number
}

export interface StreamingChunk {
  type: 'partial' | 'complete' | 'error' | 'progress'
  swarmId: string
  workerId?: string
  taskId?: string
  data: unknown
  timestamp: number
  progress: number
  totalWorkers: number
  completedWorkers: number
}

export interface AggregatedStreamResult {
  swarmId: string
  mode: AggregationMode
  partial: boolean
  result: unknown
  results: WorkerResult[]
  conflicts: ConflictInfo[]
  metrics: SwarmMetrics
  streamStats: StreamStats
}

export interface ConflictInfo {
  field: string
  values: Array<{ workerId: string; value: unknown }>
  resolved: unknown
  resolution: string
}

export interface StreamStats {
  firstResultAt: number
  lastResultAt: number
  totalChunks: number
  avgLatencyMs: number
}

const DEFAULT_CONFIG: StreamingConfig = {
  mode: 'merge',
  enableStreaming: true,
  emitPartials: true,
  minVoteConfidence: 0.6,
  conflictResolution: 'majority',
}

export class StreamingAggregator extends EventEmitter {
  private config: StreamingConfig
  private results = new Map<string, WorkerResult[]>() // swarmId -> results
  private streamStats = new Map<string, StreamStats>()
  private conflicts = new Map<string, ConflictInfo[]>()

  constructor(
    private registry: SwarmRegistry,
    config: Partial<StreamingConfig> = {},
  ) {
    super()
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  /**
   * Processes a worker result as it arrives (streaming).
   */
  processResult(swarmId: string, result: WorkerResult): void {
    // Initialize storage
    if (!this.results.has(swarmId)) {
      this.results.set(swarmId, [])
      this.streamStats.set(swarmId, {
        firstResultAt: 0,
        lastResultAt: 0,
        totalChunks: 0,
        avgLatencyMs: 0,
      })
      this.conflicts.set(swarmId, [])
    }

    const results = this.results.get(swarmId)!
    const stats = this.streamStats.get(swarmId)!

    // Add result
    results.push(result)

    // Update stats
    const now = Date.now()
    if (stats.firstResultAt === 0) {
      stats.firstResultAt = now
    }
    stats.lastResultAt = now
    stats.totalChunks++
    stats.avgLatencyMs =
      results.reduce((sum, r) => sum + r.durationMs, 0) / results.length

    logger.debug('Streaming result received', {
      swarmId,
      workerId: result.workerId,
      taskId: result.taskId,
      resultCount: results.length,
    })

    // Emit streaming chunk
    if (this.config.enableStreaming) {
      const workers = this.registry.getWorkers(swarmId)
      const completedCount = workers.filter(
        (w) => w.state === 'completed',
      ).length

      const chunk: StreamingChunk = {
        type: this.config.emitPartials ? 'partial' : 'progress',
        swarmId,
        workerId: result.workerId,
        taskId: result.taskId,
        data: this.config.emitPartials ? result.result : undefined,
        timestamp: now,
        progress: workers.length > 0 ? (completedCount / workers.length) * 100 : 0,
        totalWorkers: workers.length,
        completedWorkers: completedCount,
      }

      this.emit('chunk', chunk)
    }
  }

  /**
   * Performs final aggregation when all workers complete.
   */
  async aggregate(
    swarmId: string,
    outputFormat: 'json' | 'markdown' | 'html' = 'json',
  ): Promise<AggregatedStreamResult> {
    const swarm = this.registry.getOrThrow(swarmId)
    const workers = this.registry.getWorkers(swarmId)
    const results = this.results.get(swarmId) ?? []
    const stats = this.streamStats.get(swarmId) ?? {
      firstResultAt: 0,
      lastResultAt: 0,
      totalChunks: 0,
      avgLatencyMs: 0,
    }

    const completed = workers.filter((w) => w.state === 'completed')
    const failed = workers.filter(
      (w) => w.state === 'failed' || w.state === 'terminated',
    )

    logger.info('Performing final aggregation', {
      swarmId,
      mode: this.config.mode,
      resultCount: results.length,
    })

    // Aggregate based on mode
    let aggregatedResult: unknown

    switch (this.config.mode) {
      case 'merge':
        aggregatedResult = this.mergeResults(results, outputFormat)
        break

      case 'concat':
        aggregatedResult = this.concatResults(results, outputFormat)
        break

      case 'vote':
        aggregatedResult = this.voteResults(results)
        break

      case 'custom':
        if (this.config.customMerge) {
          aggregatedResult = this.config.customMerge(results)
        } else {
          aggregatedResult = this.mergeResults(results, outputFormat)
        }
        break

      default:
        aggregatedResult = results.map((r) => r.result)
    }

    // Calculate metrics
    const metrics: SwarmMetrics = {
      totalDurationMs: swarm.startedAt ? Date.now() - swarm.startedAt : 0,
      workerCount: workers.length,
      successfulWorkers: completed.length,
      failedWorkers: failed.length,
      totalActionsPerformed: 0, // Would need worker metrics
    }

    const streamResult: AggregatedStreamResult = {
      swarmId,
      mode: this.config.mode,
      partial: failed.length > 0,
      result: aggregatedResult,
      results,
      conflicts: this.conflicts.get(swarmId) ?? [],
      metrics,
      streamStats: stats,
    }

    // Emit final result
    this.emit('aggregated', streamResult)

    return streamResult
  }

  /**
   * Merges results into a unified object/document.
   */
  private mergeResults(
    results: WorkerResult[],
    format: 'json' | 'markdown' | 'html',
  ): unknown {
    if (format === 'json') {
      return this.deepMerge(results)
    }

    if (format === 'markdown') {
      return this.formatMarkdown(results)
    }

    if (format === 'html') {
      return this.formatHtml(results)
    }

    return results
  }

  /**
   * Deep merges result objects with conflict detection.
   */
  private deepMerge(results: WorkerResult[]): Record<string, unknown> {
    const merged: Record<string, unknown> = {}
    const conflicts: ConflictInfo[] = []

    for (const result of results) {
      if (typeof result.result !== 'object' || result.result === null) {
        continue
      }

      for (const [key, value] of Object.entries(
        result.result as Record<string, unknown>,
      )) {
        if (!(key in merged)) {
          merged[key] = value
        } else if (!this.deepEqual(merged[key], value)) {
          // Conflict detected
          const existing = conflicts.find((c) => c.field === key)

          if (existing) {
            existing.values.push({ workerId: result.workerId, value })
          } else {
            conflicts.push({
              field: key,
              values: [
                { workerId: 'previous', value: merged[key] },
                { workerId: result.workerId, value },
              ],
              resolved: this.resolveConflict(merged[key], value, result),
              resolution: this.config.conflictResolution,
            })
          }

          // Apply resolution
          merged[key] = this.resolveConflict(merged[key], value, result)
        }
      }
    }

    // Store conflicts for reporting
    if (results.length > 0) {
      const swarmId = results[0].workerId.split('-')[0] // Rough extraction
      this.conflicts.set(swarmId, conflicts)
    }

    return merged
  }

  /**
   * Resolves a conflict between two values.
   */
  private resolveConflict(
    existing: unknown,
    incoming: unknown,
    result: WorkerResult,
  ): unknown {
    switch (this.config.conflictResolution) {
      case 'first':
        return existing

      case 'last':
        return incoming

      case 'highest-confidence':
        // If confidence is higher, use incoming
        if (result.confidence && result.confidence > 0.8) {
          return incoming
        }
        return existing

      case 'majority':
      default:
        // For simple cases, prefer the incoming if it has confidence
        return result.confidence && result.confidence > 0.5
          ? incoming
          : existing
    }
  }

  /**
   * Concatenates results as a list.
   */
  private concatResults(
    results: WorkerResult[],
    format: 'json' | 'markdown' | 'html',
  ): unknown {
    const items = results.map((r) => ({
      task: r.instruction,
      result: r.result,
      workerId: r.workerId,
      durationMs: r.durationMs,
    }))

    if (format === 'json') {
      return { results: items }
    }

    if (format === 'markdown') {
      return this.formatMarkdown(results)
    }

    return items
  }

  /**
   * Voting-based aggregation for categorical results.
   */
  private voteResults(results: WorkerResult[]): unknown {
    // Group by result value
    const votes = new Map<string, number>()

    for (const result of results) {
      const key = JSON.stringify(result.result)
      const weight = result.confidence ?? 1
      votes.set(key, (votes.get(key) ?? 0) + weight)
    }

    // Find winner
    let winner: string | undefined
    let maxVotes = 0

    for (const [key, count] of votes) {
      if (count > maxVotes) {
        maxVotes = count
        winner = key
      }
    }

    // Check confidence threshold
    const totalVotes = Array.from(votes.values()).reduce((a, b) => a + b, 0)
    const confidence = maxVotes / totalVotes

    if (confidence < this.config.minVoteConfidence) {
      logger.warn('Vote result below confidence threshold', {
        confidence,
        threshold: this.config.minVoteConfidence,
      })
    }

    return {
      result: winner ? JSON.parse(winner) : null,
      confidence,
      votes: Object.fromEntries(votes),
    }
  }

  /**
   * Formats results as Markdown.
   */
  private formatMarkdown(results: WorkerResult[]): string {
    const sections = results.map((r, i) => {
      const content =
        typeof r.result === 'string'
          ? r.result
          : '```json\n' + JSON.stringify(r.result, null, 2) + '\n```'

      return `## ${i + 1}. ${r.instruction}

**Worker:** ${r.workerId} | **Duration:** ${r.durationMs}ms

${content}
`
    })

    return `# Aggregated Results

*Generated by AI Swarm Mode*

${sections.join('\n---\n\n')}

---
*${results.length} tasks completed*
`
  }

  /**
   * Formats results as HTML.
   */
  private formatHtml(results: WorkerResult[]): string {
    const sections = results
      .map((r, i) => {
        const content =
          typeof r.result === 'string'
            ? `<p>${this.escapeHtml(r.result)}</p>`
            : `<pre><code>${this.escapeHtml(JSON.stringify(r.result, null, 2))}</code></pre>`

        return `
      <section class="result-section" data-worker="${r.workerId}">
        <h2>${i + 1}. ${this.escapeHtml(r.instruction)}</h2>
        <div class="meta">
          <span class="worker">Worker: ${r.workerId}</span>
          <span class="duration">${r.durationMs}ms</span>
        </div>
        <div class="content">${content}</div>
      </section>`
      })
      .join('\n')

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Swarm Results</title>
  <style>
    * { box-sizing: border-box; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      max-width: 900px; 
      margin: 0 auto; 
      padding: 2rem;
      background: #f8f9fa;
      color: #333;
    }
    header { 
      text-align: center; 
      margin-bottom: 2rem;
      padding-bottom: 1rem;
      border-bottom: 2px solid #e9ecef;
    }
    h1 { color: #212529; margin: 0; }
    .subtitle { color: #6c757d; margin-top: 0.5rem; }
    .result-section { 
      background: white;
      padding: 1.5rem;
      margin-bottom: 1.5rem;
      border-radius: 8px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .result-section h2 { 
      margin-top: 0;
      color: #495057;
      font-size: 1.25rem;
    }
    .meta { 
      display: flex;
      gap: 1rem;
      margin-bottom: 1rem;
      font-size: 0.875rem;
      color: #6c757d;
    }
    .content { margin-top: 1rem; }
    pre { 
      background: #f1f3f4;
      padding: 1rem;
      border-radius: 4px;
      overflow-x: auto;
    }
    code { font-family: 'SF Mono', Monaco, monospace; font-size: 0.875rem; }
    footer {
      text-align: center;
      padding-top: 1rem;
      color: #6c757d;
      font-size: 0.875rem;
    }
  </style>
</head>
<body>
  <header>
    <h1>🐝 Swarm Results</h1>
    <p class="subtitle">AI Swarm Mode - Parallel Task Execution</p>
  </header>
  <main>
    ${sections}
  </main>
  <footer>
    <p>${results.length} tasks completed</p>
  </footer>
</body>
</html>`
  }

  /**
   * Deep equality check.
   */
  private deepEqual(a: unknown, b: unknown): boolean {
    return JSON.stringify(a) === JSON.stringify(b)
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

  /**
   * Creates a readable stream for results.
   */
  createStream(swarmId: string): AsyncIterable<StreamingChunk> {
    const self = this
    
    return {
      async *[Symbol.asyncIterator]() {
        const queue: StreamingChunk[] = []
        let done = false
        let resolve: (() => void) | null = null

        const chunkHandler = (chunk: StreamingChunk) => {
          if (chunk.swarmId === swarmId) {
            queue.push(chunk)
            resolve?.()
          }
        }

        const doneHandler = (result: AggregatedStreamResult) => {
          if (result.swarmId === swarmId) {
            done = true
            resolve?.()
          }
        }

        self.on('chunk', chunkHandler)
        self.on('aggregated', doneHandler)

        try {
          while (!done) {
            if (queue.length > 0) {
              yield queue.shift()!
            } else {
              await new Promise<void>((r) => {
                resolve = r
              })
            }
          }

          // Yield remaining chunks
          while (queue.length > 0) {
            yield queue.shift()!
          }
        } finally {
          self.off('chunk', chunkHandler)
          self.off('aggregated', doneHandler)
        }
      },
    }
  }

  /**
   * Cleans up resources for a swarm.
   */
  cleanup(swarmId: string): void {
    this.results.delete(swarmId)
    this.streamStats.delete(swarmId)
    this.conflicts.delete(swarmId)
  }

  /**
   * Gets current results for a swarm.
   */
  getResults(swarmId: string): WorkerResult[] {
    return this.results.get(swarmId) ?? []
  }

  /**
   * Gets stream stats for a swarm.
   */
  getStreamStats(swarmId: string): StreamStats | undefined {
    return this.streamStats.get(swarmId)
  }
}
