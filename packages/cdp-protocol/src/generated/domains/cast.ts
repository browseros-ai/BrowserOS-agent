// ── AUTO-GENERATED from CDP protocol. DO NOT EDIT. ──

// ══ Types ══

export interface Sink {
  name: string
  id: string
  session?: string
}

// ══ Commands ══

export interface EnableParams {
  presentationUrl?: string
}

export interface SetSinkToUseParams {
  sinkName: string
}

export interface StartDesktopMirroringParams {
  sinkName: string
}

export interface StartTabMirroringParams {
  sinkName: string
}

export interface StopCastingParams {
  sinkName: string
}

// ══ Events ══

export interface SinksUpdatedEvent {
  sinks: Sink[]
}

export interface IssueUpdatedEvent {
  issueMessage: string
}
