// ── AUTO-GENERATED from CDP protocol. DO NOT EDIT. ──

// ══ Types ══

export interface TouchPoint {
  x: number
  y: number
  radiusX?: number
  radiusY?: number
  rotationAngle?: number
  force?: number
  tangentialPressure?: number
  tiltX?: number
  tiltY?: number
  twist?: number
  id?: number
}

export type GestureSourceType = 'default' | 'touch' | 'mouse'

export type MouseButton =
  | 'none'
  | 'left'
  | 'middle'
  | 'right'
  | 'back'
  | 'forward'

export type TimeSinceEpoch = number

export interface DragDataItem {
  mimeType: string
  data: string
  title?: string
  baseURL?: string
}

export interface DragData {
  items: DragDataItem[]
  files?: string[]
  dragOperationsMask: number
}

// ══ Commands ══

export interface DispatchDragEventParams {
  type: 'dragEnter' | 'dragOver' | 'drop' | 'dragCancel'
  x: number
  y: number
  data: DragData
  modifiers?: number
}

export interface DispatchKeyEventParams {
  type: 'keyDown' | 'keyUp' | 'rawKeyDown' | 'char'
  modifiers?: number
  timestamp?: TimeSinceEpoch
  text?: string
  unmodifiedText?: string
  keyIdentifier?: string
  code?: string
  key?: string
  windowsVirtualKeyCode?: number
  nativeVirtualKeyCode?: number
  autoRepeat?: boolean
  isKeypad?: boolean
  isSystemKey?: boolean
  location?: number
  commands?: string[]
}

export interface InsertTextParams {
  text: string
}

export interface ImeSetCompositionParams {
  text: string
  selectionStart: number
  selectionEnd: number
  replacementStart?: number
  replacementEnd?: number
}

export interface DispatchMouseEventParams {
  type: 'mousePressed' | 'mouseReleased' | 'mouseMoved' | 'mouseWheel'
  x: number
  y: number
  modifiers?: number
  timestamp?: TimeSinceEpoch
  button?: MouseButton
  buttons?: number
  clickCount?: number
  force?: number
  tangentialPressure?: number
  tiltX?: number
  tiltY?: number
  twist?: number
  deltaX?: number
  deltaY?: number
  pointerType?: 'mouse' | 'pen'
}

export interface DispatchTouchEventParams {
  type: 'touchStart' | 'touchEnd' | 'touchMove' | 'touchCancel'
  touchPoints: TouchPoint[]
  modifiers?: number
  timestamp?: TimeSinceEpoch
}

export interface EmulateTouchFromMouseEventParams {
  type: 'mousePressed' | 'mouseReleased' | 'mouseMoved' | 'mouseWheel'
  x: number
  y: number
  button: MouseButton
  timestamp?: TimeSinceEpoch
  deltaX?: number
  deltaY?: number
  modifiers?: number
  clickCount?: number
}

export interface SetIgnoreInputEventsParams {
  ignore: boolean
}

export interface SetInterceptDragsParams {
  enabled: boolean
}

export interface SynthesizePinchGestureParams {
  x: number
  y: number
  scaleFactor: number
  relativeSpeed?: number
  gestureSourceType?: GestureSourceType
}

export interface SynthesizeScrollGestureParams {
  x: number
  y: number
  xDistance?: number
  yDistance?: number
  xOverscroll?: number
  yOverscroll?: number
  preventFling?: boolean
  speed?: number
  gestureSourceType?: GestureSourceType
  repeatCount?: number
  repeatDelayMs?: number
  interactionMarkerName?: string
}

export interface SynthesizeTapGestureParams {
  x: number
  y: number
  duration?: number
  tapCount?: number
  gestureSourceType?: GestureSourceType
}

// ══ Events ══

export interface DragInterceptedEvent {
  data: DragData
}
