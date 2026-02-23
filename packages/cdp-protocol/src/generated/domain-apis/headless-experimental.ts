// ── AUTO-GENERATED from CDP protocol. DO NOT EDIT. ──

import type {
  BeginFrameParams,
  BeginFrameResult,
} from '../domains/headless-experimental'

export interface HeadlessExperimentalApi {
  // ── Commands ──

  beginFrame(params?: BeginFrameParams): Promise<BeginFrameResult>
  disable(): Promise<void>
  enable(): Promise<void>
}
