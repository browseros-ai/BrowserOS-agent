// ── AUTO-GENERATED from CDP protocol. DO NOT EDIT. ──

import type {
  GetFeatureStateParams,
  GetFeatureStateResult,
  GetInfoResult,
  GetProcessInfoResult,
} from '../domains/system-info'

export interface SystemInfoApi {
  // ── Commands ──

  getInfo(): Promise<GetInfoResult>
  getFeatureState(params: GetFeatureStateParams): Promise<GetFeatureStateResult>
  getProcessInfo(): Promise<GetProcessInfoResult>
}
