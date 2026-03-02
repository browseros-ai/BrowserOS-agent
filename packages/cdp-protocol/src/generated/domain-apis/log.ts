// ── AUTO-GENERATED from CDP protocol. DO NOT EDIT. ──

import type {
  EntryAddedEvent,
  StartViolationsReportParams,
} from '../domains/log'

export interface LogApi {
  // ── Commands ──

  clear(): Promise<void>
  disable(): Promise<void>
  enable(): Promise<void>
  startViolationsReport(params: StartViolationsReportParams): Promise<void>
  stopViolationsReport(): Promise<void>

  // ── Events ──

  on(
    event: 'entryAdded',
    handler: (params: EntryAddedEvent) => void,
  ): () => void
}
