// ── AUTO-GENERATED from CDP protocol. DO NOT EDIT. ──

import type {
  ConsoleProfileFinishedEvent,
  ConsoleProfileStartedEvent,
  GetBestEffortCoverageResult,
  PreciseCoverageDeltaUpdateEvent,
  SetSamplingIntervalParams,
  StartPreciseCoverageParams,
  StartPreciseCoverageResult,
  StopResult,
  TakePreciseCoverageResult,
} from '../domains/profiler'

export interface ProfilerApi {
  // ── Commands ──

  disable(): Promise<void>
  enable(): Promise<void>
  getBestEffortCoverage(): Promise<GetBestEffortCoverageResult>
  setSamplingInterval(params: SetSamplingIntervalParams): Promise<void>
  start(): Promise<void>
  startPreciseCoverage(
    params?: StartPreciseCoverageParams,
  ): Promise<StartPreciseCoverageResult>
  stop(): Promise<StopResult>
  stopPreciseCoverage(): Promise<void>
  takePreciseCoverage(): Promise<TakePreciseCoverageResult>

  // ── Events ──

  on(
    event: 'consoleProfileFinished',
    handler: (params: ConsoleProfileFinishedEvent) => void,
  ): () => void
  on(
    event: 'consoleProfileStarted',
    handler: (params: ConsoleProfileStartedEvent) => void,
  ): () => void
  on(
    event: 'preciseCoverageDeltaUpdate',
    handler: (params: PreciseCoverageDeltaUpdateEvent) => void,
  ): () => void
}
