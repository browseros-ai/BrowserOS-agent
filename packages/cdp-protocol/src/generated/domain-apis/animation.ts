// ── AUTO-GENERATED from CDP protocol. DO NOT EDIT. ──

import type {
  AnimationCanceledEvent,
  AnimationCreatedEvent,
  AnimationStartedEvent,
  AnimationUpdatedEvent,
  GetCurrentTimeParams,
  GetCurrentTimeResult,
  GetPlaybackRateResult,
  ReleaseAnimationsParams,
  ResolveAnimationParams,
  ResolveAnimationResult,
  SeekAnimationsParams,
  SetPausedParams,
  SetPlaybackRateParams,
  SetTimingParams,
} from '../domains/animation'

export interface AnimationApi {
  // ── Commands ──

  disable(): Promise<void>
  enable(): Promise<void>
  getCurrentTime(params: GetCurrentTimeParams): Promise<GetCurrentTimeResult>
  getPlaybackRate(): Promise<GetPlaybackRateResult>
  releaseAnimations(params: ReleaseAnimationsParams): Promise<void>
  resolveAnimation(
    params: ResolveAnimationParams,
  ): Promise<ResolveAnimationResult>
  seekAnimations(params: SeekAnimationsParams): Promise<void>
  setPaused(params: SetPausedParams): Promise<void>
  setPlaybackRate(params: SetPlaybackRateParams): Promise<void>
  setTiming(params: SetTimingParams): Promise<void>

  // ── Events ──

  on(
    event: 'animationCanceled',
    handler: (params: AnimationCanceledEvent) => void,
  ): () => void
  on(
    event: 'animationCreated',
    handler: (params: AnimationCreatedEvent) => void,
  ): () => void
  on(
    event: 'animationStarted',
    handler: (params: AnimationStartedEvent) => void,
  ): () => void
  on(
    event: 'animationUpdated',
    handler: (params: AnimationUpdatedEvent) => void,
  ): () => void
}
