// ── AUTO-GENERATED from CDP protocol. DO NOT EDIT. ──

// ══ Types ══

export interface GPUDevice {
  vendorId: number
  deviceId: number
  subSysId?: number
  revision?: number
  vendorString: string
  deviceString: string
  driverVendor: string
  driverVersion: string
}

export interface Size {
  width: number
  height: number
}

export interface VideoDecodeAcceleratorCapability {
  profile: string
  maxResolution: Size
  minResolution: Size
}

export interface VideoEncodeAcceleratorCapability {
  profile: string
  maxResolution: Size
  maxFramerateNumerator: number
  maxFramerateDenominator: number
}

export type SubsamplingFormat = 'yuv420' | 'yuv422' | 'yuv444'

export type ImageType = 'jpeg' | 'webp' | 'unknown'

export interface GPUInfo {
  devices: GPUDevice[]
  auxAttributes?: Record<string, unknown>
  featureStatus?: Record<string, unknown>
  driverBugWorkarounds: string[]
  videoDecoding: VideoDecodeAcceleratorCapability[]
  videoEncoding: VideoEncodeAcceleratorCapability[]
}

export interface ProcessInfo {
  type: string
  id: number
  cpuTime: number
}

// ══ Commands ══

export interface GetInfoResult {
  gpu: GPUInfo
  modelName: string
  modelVersion: string
  commandLine: string
}

export interface GetFeatureStateParams {
  featureState: string
}

export interface GetFeatureStateResult {
  featureEnabled: boolean
}

export interface GetProcessInfoResult {
  processInfo: ProcessInfo[]
}
