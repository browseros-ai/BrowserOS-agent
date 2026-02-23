// ── AUTO-GENERATED from CDP protocol. DO NOT EDIT. ──

import type {
  EnableParams,
  GetMetricsResult,
  MetricsEvent,
  SetTimeDomainParams,
} from '../domains/performance'

export interface PerformanceApi {
  // ── Commands ──

  disable(): Promise<void>
  enable(params?: EnableParams): Promise<void>
  setTimeDomain(params: SetTimeDomainParams): Promise<void>
  getMetrics(): Promise<GetMetricsResult>

  // ── Events ──

  on(event: 'metrics', handler: (params: MetricsEvent) => void): () => void
}
