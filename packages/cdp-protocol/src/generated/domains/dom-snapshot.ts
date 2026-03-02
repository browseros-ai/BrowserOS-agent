// ── AUTO-GENERATED from CDP protocol. DO NOT EDIT. ──

import type { BackendNodeId, PseudoType, Rect, ShadowRootType } from './dom'
import type { EventListener } from './dom-debugger'
import type { FrameId } from './page'

// ══ Types ══

export interface DOMNode {
  nodeType: number
  nodeName: string
  nodeValue: string
  textValue?: string
  inputValue?: string
  inputChecked?: boolean
  optionSelected?: boolean
  backendNodeId: BackendNodeId
  childNodeIndexes?: number[]
  attributes?: NameValue[]
  pseudoElementIndexes?: number[]
  layoutNodeIndex?: number
  documentURL?: string
  baseURL?: string
  contentLanguage?: string
  documentEncoding?: string
  publicId?: string
  systemId?: string
  frameId?: FrameId
  contentDocumentIndex?: number
  pseudoType?: PseudoType
  shadowRootType?: ShadowRootType
  isClickable?: boolean
  eventListeners?: EventListener[]
  currentSourceURL?: string
  originURL?: string
  scrollOffsetX?: number
  scrollOffsetY?: number
}

export interface InlineTextBox {
  boundingBox: Rect
  startCharacterIndex: number
  numCharacters: number
}

export interface LayoutTreeNode {
  domNodeIndex: number
  boundingBox: Rect
  layoutText?: string
  inlineTextNodes?: InlineTextBox[]
  styleIndex?: number
  paintOrder?: number
  isStackingContext?: boolean
}

export interface ComputedStyle {
  properties: NameValue[]
}

export interface NameValue {
  name: string
  value: string
}

export type StringIndex = number

export type ArrayOfStrings = StringIndex[]

export interface RareStringData {
  index: number[]
  value: StringIndex[]
}

export interface RareBooleanData {
  index: number[]
}

export interface RareIntegerData {
  index: number[]
  value: number[]
}

export type Rectangle = number[]

export interface DocumentSnapshot {
  documentURL: StringIndex
  title: StringIndex
  baseURL: StringIndex
  contentLanguage: StringIndex
  encodingName: StringIndex
  publicId: StringIndex
  systemId: StringIndex
  frameId: StringIndex
  nodes: NodeTreeSnapshot
  layout: LayoutTreeSnapshot
  textBoxes: TextBoxSnapshot
  scrollOffsetX?: number
  scrollOffsetY?: number
  contentWidth?: number
  contentHeight?: number
}

export interface NodeTreeSnapshot {
  parentIndex?: number[]
  nodeType?: number[]
  shadowRootType?: RareStringData
  nodeName?: StringIndex[]
  nodeValue?: StringIndex[]
  backendNodeId?: BackendNodeId[]
  attributes?: ArrayOfStrings[]
  textValue?: RareStringData
  inputValue?: RareStringData
  inputChecked?: RareBooleanData
  optionSelected?: RareBooleanData
  contentDocumentIndex?: RareIntegerData
  pseudoType?: RareStringData
  pseudoIdentifier?: RareStringData
  isClickable?: RareBooleanData
  currentSourceURL?: RareStringData
  originURL?: RareStringData
}

export interface LayoutTreeSnapshot {
  nodeIndex: number[]
  styles: ArrayOfStrings[]
  bounds: Rectangle[]
  text: StringIndex[]
  stackingContexts: RareBooleanData
  paintOrders?: number[]
  offsetRects?: Rectangle[]
  scrollRects?: Rectangle[]
  clientRects?: Rectangle[]
  blendedBackgroundColors?: StringIndex[]
  textColorOpacities?: number[]
}

export interface TextBoxSnapshot {
  layoutIndex: number[]
  bounds: Rectangle[]
  start: number[]
  length: number[]
}

// ══ Commands ══

export interface GetSnapshotParams {
  computedStyleWhitelist: string[]
  includeEventListeners?: boolean
  includePaintOrder?: boolean
  includeUserAgentShadowTree?: boolean
}

export interface GetSnapshotResult {
  domNodes: DOMNode[]
  layoutTreeNodes: LayoutTreeNode[]
  computedStyles: ComputedStyle[]
}

export interface CaptureSnapshotParams {
  computedStyles: string[]
  includePaintOrder?: boolean
  includeDOMRects?: boolean
  includeBlendedBackgroundColors?: boolean
  includeTextColorOpacities?: boolean
}

export interface CaptureSnapshotResult {
  documents: DocumentSnapshot[]
  strings: string[]
}
