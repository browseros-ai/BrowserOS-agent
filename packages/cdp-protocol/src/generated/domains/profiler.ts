// ── AUTO-GENERATED from CDP protocol. DO NOT EDIT. ──

import type { Location } from './debugger'
import type { CallFrame, ScriptId } from './runtime'

// ══ Types ══

export interface ProfileNode {
  id: number
  callFrame: CallFrame
  hitCount?: number
  children?: number[]
  deoptReason?: string
  positionTicks?: PositionTickInfo[]
}

export interface Profile {
  nodes: ProfileNode[]
  startTime: number
  endTime: number
  samples?: number[]
  timeDeltas?: number[]
}

export interface PositionTickInfo {
  line: number
  ticks: number
}

export interface CoverageRange {
  startOffset: number
  endOffset: number
  count: number
}

export interface FunctionCoverage {
  functionName: string
  ranges: CoverageRange[]
  isBlockCoverage: boolean
}

export interface ScriptCoverage {
  scriptId: ScriptId
  url: string
  functions: FunctionCoverage[]
}

// ══ Commands ══

export interface GetBestEffortCoverageResult {
  result: ScriptCoverage[]
}

export interface SetSamplingIntervalParams {
  interval: number
}

export interface StartPreciseCoverageParams {
  callCount?: boolean
  detailed?: boolean
  allowTriggeredUpdates?: boolean
}

export interface StartPreciseCoverageResult {
  timestamp: number
}

export interface StopResult {
  profile: Profile
}

export interface TakePreciseCoverageResult {
  result: ScriptCoverage[]
  timestamp: number
}

// ══ Events ══

export interface ConsoleProfileFinishedEvent {
  id: string
  location: Location
  profile: Profile
  title?: string
}

export interface ConsoleProfileStartedEvent {
  id: string
  location: Location
  title?: string
}

export interface PreciseCoverageDeltaUpdateEvent {
  timestamp: number
  occasion: string
  result: ScriptCoverage[]
}
