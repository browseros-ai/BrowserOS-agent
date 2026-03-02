// ── AUTO-GENERATED from CDP protocol. DO NOT EDIT. ──

import type { BackendNodeId, NodeId } from './dom'
import type { RemoteObject, RemoteObjectId, ScriptId } from './runtime'

// ══ Types ══

export type DOMBreakpointType =
  | 'subtree-modified'
  | 'attribute-modified'
  | 'node-removed'

export type CSPViolationType =
  | 'trustedtype-sink-violation'
  | 'trustedtype-policy-violation'

export interface EventListener {
  type: string
  useCapture: boolean
  passive: boolean
  once: boolean
  scriptId: ScriptId
  lineNumber: number
  columnNumber: number
  handler?: RemoteObject
  originalHandler?: RemoteObject
  backendNodeId?: BackendNodeId
}

// ══ Commands ══

export interface GetEventListenersParams {
  objectId: RemoteObjectId
  depth?: number
  pierce?: boolean
}

export interface GetEventListenersResult {
  listeners: EventListener[]
}

export interface RemoveDOMBreakpointParams {
  nodeId: NodeId
  type: DOMBreakpointType
}

export interface RemoveEventListenerBreakpointParams {
  eventName: string
  targetName?: string
}

export interface RemoveInstrumentationBreakpointParams {
  eventName: string
}

export interface RemoveXHRBreakpointParams {
  url: string
}

export interface SetBreakOnCSPViolationParams {
  violationTypes: CSPViolationType[]
}

export interface SetDOMBreakpointParams {
  nodeId: NodeId
  type: DOMBreakpointType
}

export interface SetEventListenerBreakpointParams {
  eventName: string
  targetName?: string
}

export interface SetInstrumentationBreakpointParams {
  eventName: string
}

export interface SetXHRBreakpointParams {
  url: string
}
