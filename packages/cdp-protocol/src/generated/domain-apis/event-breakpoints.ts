// ── AUTO-GENERATED from CDP protocol. DO NOT EDIT. ──

import type {
  RemoveInstrumentationBreakpointParams,
  SetInstrumentationBreakpointParams,
} from '../domains/event-breakpoints'

export interface EventBreakpointsApi {
  // ── Commands ──

  setInstrumentationBreakpoint(
    params: SetInstrumentationBreakpointParams,
  ): Promise<void>
  removeInstrumentationBreakpoint(
    params: RemoveInstrumentationBreakpointParams,
  ): Promise<void>
  disable(): Promise<void>
}
