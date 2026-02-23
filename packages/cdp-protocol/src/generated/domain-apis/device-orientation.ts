// ── AUTO-GENERATED from CDP protocol. DO NOT EDIT. ──

import type { SetDeviceOrientationOverrideParams } from '../domains/device-orientation'

export interface DeviceOrientationApi {
  // ── Commands ──

  clearDeviceOrientationOverride(): Promise<void>
  setDeviceOrientationOverride(
    params: SetDeviceOrientationOverrideParams,
  ): Promise<void>
}
