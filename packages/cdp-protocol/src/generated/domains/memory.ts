// ── AUTO-GENERATED from CDP protocol. DO NOT EDIT. ──

// ══ Types ══

export type PressureLevel = 'moderate' | 'critical'

export interface SamplingProfileNode {
  size: number
  total: number
  stack: string[]
}

export interface SamplingProfile {
  samples: SamplingProfileNode[]
  modules: Module[]
}

export interface Module {
  name: string
  uuid: string
  baseAddress: string
  size: number
}

export interface DOMCounter {
  name: string
  count: number
}

// ══ Commands ══

export interface GetDOMCountersResult {
  documents: number
  nodes: number
  jsEventListeners: number
}

export interface GetDOMCountersForLeakDetectionResult {
  counters: DOMCounter[]
}

export interface SetPressureNotificationsSuppressedParams {
  suppressed: boolean
}

export interface SimulatePressureNotificationParams {
  level: PressureLevel
}

export interface StartSamplingParams {
  samplingInterval?: number
  suppressRandomness?: boolean
}

export interface GetAllTimeSamplingProfileResult {
  profile: SamplingProfile
}

export interface GetBrowserSamplingProfileResult {
  profile: SamplingProfile
}

export interface GetSamplingProfileResult {
  profile: SamplingProfile
}
