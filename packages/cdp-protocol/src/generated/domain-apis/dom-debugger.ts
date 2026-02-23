// ── AUTO-GENERATED from CDP protocol. DO NOT EDIT. ──

import type {
  GetEventListenersParams,
  GetEventListenersResult,
  RemoveDOMBreakpointParams,
  RemoveEventListenerBreakpointParams,
  RemoveInstrumentationBreakpointParams,
  RemoveXHRBreakpointParams,
  SetBreakOnCSPViolationParams,
  SetDOMBreakpointParams,
  SetEventListenerBreakpointParams,
  SetInstrumentationBreakpointParams,
  SetXHRBreakpointParams,
} from '../domains/dom-debugger'

export interface DOMDebuggerApi {
  // ── Commands ──

  getEventListeners(
    params: GetEventListenersParams,
  ): Promise<GetEventListenersResult>
  removeDOMBreakpoint(params: RemoveDOMBreakpointParams): Promise<void>
  removeEventListenerBreakpoint(
    params: RemoveEventListenerBreakpointParams,
  ): Promise<void>
  removeInstrumentationBreakpoint(
    params: RemoveInstrumentationBreakpointParams,
  ): Promise<void>
  removeXHRBreakpoint(params: RemoveXHRBreakpointParams): Promise<void>
  setBreakOnCSPViolation(params: SetBreakOnCSPViolationParams): Promise<void>
  setDOMBreakpoint(params: SetDOMBreakpointParams): Promise<void>
  setEventListenerBreakpoint(
    params: SetEventListenerBreakpointParams,
  ): Promise<void>
  setInstrumentationBreakpoint(
    params: SetInstrumentationBreakpointParams,
  ): Promise<void>
  setXHRBreakpoint(params: SetXHRBreakpointParams): Promise<void>
}
