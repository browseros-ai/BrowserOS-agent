// ── AUTO-GENERATED from CDP protocol. DO NOT EDIT. ──

import type {
  GetAllTimeSamplingProfileResult,
  GetBrowserSamplingProfileResult,
  GetDOMCountersForLeakDetectionResult,
  GetDOMCountersResult,
  GetSamplingProfileResult,
  SetPressureNotificationsSuppressedParams,
  SimulatePressureNotificationParams,
  StartSamplingParams,
} from '../domains/memory'

export interface MemoryApi {
  // ── Commands ──

  getDOMCounters(): Promise<GetDOMCountersResult>
  getDOMCountersForLeakDetection(): Promise<GetDOMCountersForLeakDetectionResult>
  prepareForLeakDetection(): Promise<void>
  forciblyPurgeJavaScriptMemory(): Promise<void>
  setPressureNotificationsSuppressed(
    params: SetPressureNotificationsSuppressedParams,
  ): Promise<void>
  simulatePressureNotification(
    params: SimulatePressureNotificationParams,
  ): Promise<void>
  startSampling(params?: StartSamplingParams): Promise<void>
  stopSampling(): Promise<void>
  getAllTimeSamplingProfile(): Promise<GetAllTimeSamplingProfileResult>
  getBrowserSamplingProfile(): Promise<GetBrowserSamplingProfileResult>
  getSamplingProfile(): Promise<GetSamplingProfileResult>
}
