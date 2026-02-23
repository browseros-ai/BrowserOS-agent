// ── AUTO-GENERATED from CDP protocol. DO NOT EDIT. ──

import type { BackendNodeId, NodeId } from './dom'
import type { FrameId } from './page'
import type { RemoteObjectId } from './runtime'

// ══ Types ══

export type AXNodeId = string

export type AXValueType =
  | 'boolean'
  | 'tristate'
  | 'booleanOrUndefined'
  | 'idref'
  | 'idrefList'
  | 'integer'
  | 'node'
  | 'nodeList'
  | 'number'
  | 'string'
  | 'computedString'
  | 'token'
  | 'tokenList'
  | 'domRelation'
  | 'role'
  | 'internalRole'
  | 'valueUndefined'

export type AXValueSourceType =
  | 'attribute'
  | 'implicit'
  | 'style'
  | 'contents'
  | 'placeholder'
  | 'relatedElement'

export type AXValueNativeSourceType =
  | 'description'
  | 'figcaption'
  | 'label'
  | 'labelfor'
  | 'labelwrapped'
  | 'legend'
  | 'rubyannotation'
  | 'tablecaption'
  | 'title'
  | 'other'

export interface AXValueSource {
  type: AXValueSourceType
  value?: AXValue
  attribute?: string
  attributeValue?: AXValue
  superseded?: boolean
  nativeSource?: AXValueNativeSourceType
  nativeSourceValue?: AXValue
  invalid?: boolean
  invalidReason?: string
}

export interface AXRelatedNode {
  backendDOMNodeId: BackendNodeId
  idref?: string
  text?: string
}

export interface AXProperty {
  name: AXPropertyName
  value: AXValue
}

export interface AXValue {
  type: AXValueType
  value?: unknown
  relatedNodes?: AXRelatedNode[]
  sources?: AXValueSource[]
}

export type AXPropertyName =
  | 'actions'
  | 'busy'
  | 'disabled'
  | 'editable'
  | 'focusable'
  | 'focused'
  | 'hidden'
  | 'hiddenRoot'
  | 'invalid'
  | 'keyshortcuts'
  | 'settable'
  | 'roledescription'
  | 'live'
  | 'atomic'
  | 'relevant'
  | 'root'
  | 'autocomplete'
  | 'hasPopup'
  | 'level'
  | 'multiselectable'
  | 'orientation'
  | 'multiline'
  | 'readonly'
  | 'required'
  | 'valuemin'
  | 'valuemax'
  | 'valuetext'
  | 'checked'
  | 'expanded'
  | 'modal'
  | 'pressed'
  | 'selected'
  | 'activedescendant'
  | 'controls'
  | 'describedby'
  | 'details'
  | 'errormessage'
  | 'flowto'
  | 'labelledby'
  | 'owns'
  | 'url'
  | 'activeFullscreenElement'
  | 'activeModalDialog'
  | 'activeAriaModalDialog'
  | 'ariaHiddenElement'
  | 'ariaHiddenSubtree'
  | 'emptyAlt'
  | 'emptyText'
  | 'inertElement'
  | 'inertSubtree'
  | 'labelContainer'
  | 'labelFor'
  | 'notRendered'
  | 'notVisible'
  | 'presentationalRole'
  | 'probablyPresentational'
  | 'inactiveCarouselTabContent'
  | 'uninteresting'

export interface AXNode {
  nodeId: AXNodeId
  ignored: boolean
  ignoredReasons?: AXProperty[]
  role?: AXValue
  chromeRole?: AXValue
  name?: AXValue
  description?: AXValue
  value?: AXValue
  properties?: AXProperty[]
  parentId?: AXNodeId
  childIds?: AXNodeId[]
  backendDOMNodeId?: BackendNodeId
  frameId?: FrameId
}

// ══ Commands ══

export interface GetPartialAXTreeParams {
  nodeId?: NodeId
  backendNodeId?: BackendNodeId
  objectId?: RemoteObjectId
  fetchRelatives?: boolean
}

export interface GetPartialAXTreeResult {
  nodes: AXNode[]
}

export interface GetFullAXTreeParams {
  depth?: number
  frameId?: FrameId
}

export interface GetFullAXTreeResult {
  nodes: AXNode[]
}

export interface GetRootAXNodeParams {
  frameId?: FrameId
}

export interface GetRootAXNodeResult {
  node: AXNode
}

export interface GetAXNodeAndAncestorsParams {
  nodeId?: NodeId
  backendNodeId?: BackendNodeId
  objectId?: RemoteObjectId
}

export interface GetAXNodeAndAncestorsResult {
  nodes: AXNode[]
}

export interface GetChildAXNodesParams {
  id: AXNodeId
  frameId?: FrameId
}

export interface GetChildAXNodesResult {
  nodes: AXNode[]
}

export interface QueryAXTreeParams {
  nodeId?: NodeId
  backendNodeId?: BackendNodeId
  objectId?: RemoteObjectId
  accessibleName?: string
  role?: string
}

export interface QueryAXTreeResult {
  nodes: AXNode[]
}

// ══ Events ══

export interface LoadCompleteEvent {
  root: AXNode
}

export interface NodesUpdatedEvent {
  nodes: AXNode[]
}
