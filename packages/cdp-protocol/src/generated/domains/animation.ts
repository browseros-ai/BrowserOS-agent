// ── AUTO-GENERATED from CDP protocol. DO NOT EDIT. ──

import type { BackendNodeId, ScrollOrientation } from './dom'
import type { RemoteObject } from './runtime'

// ══ Types ══

export interface Animation {
  id: string
  name: string
  pausedState: boolean
  playState: string
  playbackRate: number
  startTime: number
  currentTime: number
  type: 'CSSTransition' | 'CSSAnimation' | 'WebAnimation'
  source?: AnimationEffect
  cssId?: string
  viewOrScrollTimeline?: ViewOrScrollTimeline
}

export interface ViewOrScrollTimeline {
  sourceNodeId?: BackendNodeId
  startOffset?: number
  endOffset?: number
  subjectNodeId?: BackendNodeId
  axis: ScrollOrientation
}

export interface AnimationEffect {
  delay: number
  endDelay: number
  iterationStart: number
  iterations?: number
  duration: number
  direction: string
  fill: string
  backendNodeId?: BackendNodeId
  keyframesRule?: KeyframesRule
  easing: string
}

export interface KeyframesRule {
  name?: string
  keyframes: KeyframeStyle[]
}

export interface KeyframeStyle {
  offset: string
  easing: string
}

// ══ Commands ══

export interface GetCurrentTimeParams {
  id: string
}

export interface GetCurrentTimeResult {
  currentTime: number
}

export interface GetPlaybackRateResult {
  playbackRate: number
}

export interface ReleaseAnimationsParams {
  animations: string[]
}

export interface ResolveAnimationParams {
  animationId: string
}

export interface ResolveAnimationResult {
  remoteObject: RemoteObject
}

export interface SeekAnimationsParams {
  animations: string[]
  currentTime: number
}

export interface SetPausedParams {
  animations: string[]
  paused: boolean
}

export interface SetPlaybackRateParams {
  playbackRate: number
}

export interface SetTimingParams {
  animationId: string
  duration: number
  delay: number
}

// ══ Events ══

export interface AnimationCanceledEvent {
  id: string
}

export interface AnimationCreatedEvent {
  id: string
}

export interface AnimationStartedEvent {
  animation: Animation
}

export interface AnimationUpdatedEvent {
  animation: Animation
}
