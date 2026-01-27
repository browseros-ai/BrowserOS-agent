/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * SwarmTracer - Distributed tracing for swarm operations
 *
 * Provides OpenTelemetry-compatible tracing with spans,
 * context propagation, and performance metrics.
 */

import { randomUUID } from 'node:crypto'
import { EventEmitter } from 'node:events'
import { logger } from '../../lib/logger'

export type SpanKind = 'internal' | 'server' | 'client' | 'producer' | 'consumer'
export type SpanStatus = 'unset' | 'ok' | 'error'

export interface SpanContext {
  traceId: string
  spanId: string
  parentSpanId?: string
  traceFlags: number
}

export interface SpanAttributes {
  [key: string]: string | number | boolean | undefined
}

export interface SpanEvent {
  name: string
  timestamp: number
  attributes?: SpanAttributes
}

export interface Span {
  context: SpanContext
  name: string
  kind: SpanKind
  status: SpanStatus
  statusMessage?: string
  startTime: number
  endTime?: number
  attributes: SpanAttributes
  events: SpanEvent[]
  links: SpanContext[]
  isEnded: boolean
}

export interface TracerConfig {
  serviceName: string
  enabled: boolean
  samplingRate: number
  maxSpansPerTrace: number
  exportIntervalMs: number
  /** Export function for sending traces */
  exporter?: (spans: Span[]) => Promise<void>
}

const DEFAULT_CONFIG: TracerConfig = {
  serviceName: 'browseros-swarm',
  enabled: true,
  samplingRate: 1.0,
  maxSpansPerTrace: 1000,
  exportIntervalMs: 30_000,
}

export class SwarmTracer extends EventEmitter {
  private config: TracerConfig
  private traces = new Map<string, Span[]>()
  private activeSpans = new Map<string, Span>()
  private exportInterval?: NodeJS.Timeout

  constructor(config: Partial<TracerConfig> = {}) {
    super()
    this.config = { ...DEFAULT_CONFIG, ...config }

    if (this.config.enabled && this.config.exporter) {
      this.startExporter()
    }
  }

  /**
   * Starts a new trace.
   */
  startTrace(name: string, attributes: SpanAttributes = {}): Span {
    const traceId = this.generateTraceId()
    return this.startSpan(name, { traceId, attributes })
  }

  /**
   * Starts a new span within a trace.
   */
  startSpan(
    name: string,
    options: {
      traceId?: string
      parentSpan?: Span
      kind?: SpanKind
      attributes?: SpanAttributes
      links?: SpanContext[]
    } = {},
  ): Span {
    if (!this.config.enabled) {
      return this.createNoopSpan(name)
    }

    // Sampling
    if (Math.random() > this.config.samplingRate) {
      return this.createNoopSpan(name)
    }

    const traceId = options.traceId ?? options.parentSpan?.context.traceId ?? this.generateTraceId()
    const spanId = this.generateSpanId()
    const parentSpanId = options.parentSpan?.context.spanId

    const span: Span = {
      context: {
        traceId,
        spanId,
        parentSpanId,
        traceFlags: 1, // Sampled
      },
      name,
      kind: options.kind ?? 'internal',
      status: 'unset',
      startTime: Date.now(),
      attributes: {
        'service.name': this.config.serviceName,
        ...options.attributes,
      },
      events: [],
      links: options.links ?? [],
      isEnded: false,
    }

    // Store in trace
    if (!this.traces.has(traceId)) {
      this.traces.set(traceId, [])
    }

    const traceSpans = this.traces.get(traceId)!
    if (traceSpans.length < this.config.maxSpansPerTrace) {
      traceSpans.push(span)
    }

    this.activeSpans.set(spanId, span)

    logger.debug('Span started', {
      traceId,
      spanId,
      name,
      parentSpanId,
    })

    return span
  }

  /**
   * Ends a span.
   */
  endSpan(span: Span, status?: SpanStatus, statusMessage?: string): void {
    if (span.isEnded || !this.config.enabled) return

    span.endTime = Date.now()
    span.isEnded = true
    span.status = status ?? 'ok'
    span.statusMessage = statusMessage

    this.activeSpans.delete(span.context.spanId)

    const duration = span.endTime - span.startTime

    logger.debug('Span ended', {
      traceId: span.context.traceId,
      spanId: span.context.spanId,
      name: span.name,
      durationMs: duration,
      status: span.status,
    })

    this.emit('span_ended', span)
  }

  /**
   * Adds an event to a span.
   */
  addEvent(
    span: Span,
    name: string,
    attributes?: SpanAttributes,
  ): void {
    if (span.isEnded) return

    span.events.push({
      name,
      timestamp: Date.now(),
      attributes,
    })
  }

  /**
   * Sets span attributes.
   */
  setAttributes(span: Span, attributes: SpanAttributes): void {
    if (span.isEnded) return
    Object.assign(span.attributes, attributes)
  }

  /**
   * Records an exception on a span.
   */
  recordException(span: Span, error: Error): void {
    this.addEvent(span, 'exception', {
      'exception.type': error.name,
      'exception.message': error.message,
      'exception.stacktrace': error.stack,
    })
    span.status = 'error'
    span.statusMessage = error.message
  }

  /**
   * Creates a child span.
   */
  startChildSpan(
    parent: Span,
    name: string,
    kind?: SpanKind,
    attributes?: SpanAttributes,
  ): Span {
    return this.startSpan(name, {
      parentSpan: parent,
      kind,
      attributes,
    })
  }

  /**
   * Wraps an async function with a span.
   */
  async withSpan<T>(
    name: string,
    fn: (span: Span) => Promise<T>,
    options?: {
      parentSpan?: Span
      kind?: SpanKind
      attributes?: SpanAttributes
    },
  ): Promise<T> {
    const span = this.startSpan(name, options)

    try {
      const result = await fn(span)
      this.endSpan(span, 'ok')
      return result
    } catch (error) {
      this.recordException(span, error as Error)
      this.endSpan(span, 'error', (error as Error).message)
      throw error
    }
  }

  /**
   * Gets a trace by ID.
   */
  getTrace(traceId: string): Span[] | undefined {
    return this.traces.get(traceId)
  }

  /**
   * Gets all active spans.
   */
  getActiveSpans(): Span[] {
    return Array.from(this.activeSpans.values())
  }

  /**
   * Exports completed traces.
   */
  async export(): Promise<void> {
    if (!this.config.exporter) return

    const completedTraces: Span[] = []

    for (const [traceId, spans] of this.traces) {
      const allEnded = spans.every((s) => s.isEnded)
      if (allEnded && spans.length > 0) {
        completedTraces.push(...spans)
        this.traces.delete(traceId)
      }
    }

    if (completedTraces.length > 0) {
      try {
        await this.config.exporter(completedTraces)
        logger.debug('Traces exported', { count: completedTraces.length })
      } catch (error) {
        logger.error('Failed to export traces', { error })
      }
    }
  }

  /**
   * Starts the periodic exporter.
   */
  private startExporter(): void {
    this.exportInterval = setInterval(() => {
      this.export()
    }, this.config.exportIntervalMs)
  }

  /**
   * Creates a noop span for disabled/unsampled traces.
   */
  private createNoopSpan(name: string): Span {
    return {
      context: {
        traceId: '0',
        spanId: '0',
        traceFlags: 0,
      },
      name,
      kind: 'internal',
      status: 'unset',
      startTime: Date.now(),
      attributes: {},
      events: [],
      links: [],
      isEnded: true,
    }
  }

  /**
   * Generates a trace ID (32 hex chars).
   */
  private generateTraceId(): string {
    return randomUUID().replace(/-/g, '')
  }

  /**
   * Generates a span ID (16 hex chars).
   */
  private generateSpanId(): string {
    return randomUUID().replace(/-/g, '').slice(0, 16)
  }

  /**
   * Clears all traces.
   */
  clear(): void {
    this.traces.clear()
    this.activeSpans.clear()
  }

  /**
   * Shuts down the tracer.
   */
  async shutdown(): Promise<void> {
    if (this.exportInterval) {
      clearInterval(this.exportInterval)
    }
    await this.export()
    this.clear()
  }
}

/**
 * Swarm-specific metrics collector.
 */
export interface SwarmMetricsData {
  swarmId: string
  timestamp: number
  swarmState: string
  workerCount: number
  activeWorkers: number
  completedWorkers: number
  failedWorkers: number
  taskQueueSize: number
  avgWorkerLatencyMs: number
  avgTaskDurationMs: number
  memoryUsageMb: number
  cpuUtilization: number
  throughputTasksPerMin: number
  errorRate: number
}

export class SwarmMetricsCollector extends EventEmitter {
  private metrics = new Map<string, SwarmMetricsData[]>()
  private historyLimit = 1000

  /**
   * Records metrics for a swarm.
   */
  record(data: Omit<SwarmMetricsData, 'timestamp'>): void {
    const entry: SwarmMetricsData = {
      ...data,
      timestamp: Date.now(),
    }

    if (!this.metrics.has(data.swarmId)) {
      this.metrics.set(data.swarmId, [])
    }

    const history = this.metrics.get(data.swarmId)!
    history.push(entry)

    // Trim history
    if (history.length > this.historyLimit) {
      history.shift()
    }

    this.emit('metrics', entry)
  }

  /**
   * Gets metrics history for a swarm.
   */
  getHistory(
    swarmId: string,
    since?: number,
  ): SwarmMetricsData[] {
    const history = this.metrics.get(swarmId) ?? []
    if (since) {
      return history.filter((m) => m.timestamp >= since)
    }
    return history
  }

  /**
   * Gets latest metrics for a swarm.
   */
  getLatest(swarmId: string): SwarmMetricsData | undefined {
    const history = this.metrics.get(swarmId)
    return history?.[history.length - 1]
  }

  /**
   * Computes aggregated metrics.
   */
  getAggregated(swarmId: string, windowMs: number = 60_000): {
    avgWorkerLatencyMs: number
    avgTaskDurationMs: number
    avgThroughput: number
    avgErrorRate: number
    peakWorkerCount: number
  } {
    const since = Date.now() - windowMs
    const history = this.getHistory(swarmId, since)

    if (history.length === 0) {
      return {
        avgWorkerLatencyMs: 0,
        avgTaskDurationMs: 0,
        avgThroughput: 0,
        avgErrorRate: 0,
        peakWorkerCount: 0,
      }
    }

    return {
      avgWorkerLatencyMs:
        history.reduce((s, m) => s + m.avgWorkerLatencyMs, 0) / history.length,
      avgTaskDurationMs:
        history.reduce((s, m) => s + m.avgTaskDurationMs, 0) / history.length,
      avgThroughput:
        history.reduce((s, m) => s + m.throughputTasksPerMin, 0) / history.length,
      avgErrorRate:
        history.reduce((s, m) => s + m.errorRate, 0) / history.length,
      peakWorkerCount: Math.max(...history.map((m) => m.workerCount)),
    }
  }

  /**
   * Clears metrics for a swarm.
   */
  clear(swarmId: string): void {
    this.metrics.delete(swarmId)
  }

  /**
   * Clears all metrics.
   */
  clearAll(): void {
    this.metrics.clear()
  }
}

/**
 * Health check endpoint data.
 */
export interface SwarmHealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy'
  checks: {
    name: string
    status: 'pass' | 'warn' | 'fail'
    message?: string
    durationMs: number
  }[]
  version: string
  uptime: number
  timestamp: number
}

export class SwarmHealthChecker {
  private startTime = Date.now()
  private version = '1.0.0'

  constructor(
    private checks: Array<{
      name: string
      check: () => Promise<{ ok: boolean; message?: string }>
      critical?: boolean
    }> = [],
  ) {}

  /**
   * Runs all health checks.
   */
  async check(): Promise<SwarmHealthStatus> {
    const results: SwarmHealthStatus['checks'] = []
    let hasFailure = false
    let hasWarning = false

    for (const { name, check, critical } of this.checks) {
      const start = Date.now()

      try {
        const result = await check()
        const duration = Date.now() - start

        if (result.ok) {
          results.push({
            name,
            status: 'pass',
            message: result.message,
            durationMs: duration,
          })
        } else {
          const status = critical ? 'fail' : 'warn'
          results.push({
            name,
            status,
            message: result.message,
            durationMs: duration,
          })

          if (critical) hasFailure = true
          else hasWarning = true
        }
      } catch (error) {
        const duration = Date.now() - start
        results.push({
          name,
          status: critical ? 'fail' : 'warn',
          message: (error as Error).message,
          durationMs: duration,
        })

        if (critical) hasFailure = true
        else hasWarning = true
      }
    }

    return {
      status: hasFailure ? 'unhealthy' : hasWarning ? 'degraded' : 'healthy',
      checks: results,
      version: this.version,
      uptime: Date.now() - this.startTime,
      timestamp: Date.now(),
    }
  }

  /**
   * Adds a health check.
   */
  addCheck(
    name: string,
    check: () => Promise<{ ok: boolean; message?: string }>,
    critical = false,
  ): void {
    this.checks.push({ name, check, critical })
  }
}
