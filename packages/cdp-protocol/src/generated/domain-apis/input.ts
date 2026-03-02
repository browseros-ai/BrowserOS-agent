// ── AUTO-GENERATED from CDP protocol. DO NOT EDIT. ──

import type {
  DispatchDragEventParams,
  DispatchKeyEventParams,
  DispatchMouseEventParams,
  DispatchTouchEventParams,
  DragInterceptedEvent,
  EmulateTouchFromMouseEventParams,
  ImeSetCompositionParams,
  InsertTextParams,
  SetIgnoreInputEventsParams,
  SetInterceptDragsParams,
  SynthesizePinchGestureParams,
  SynthesizeScrollGestureParams,
  SynthesizeTapGestureParams,
} from '../domains/input'

export interface InputApi {
  // ── Commands ──

  dispatchDragEvent(params: DispatchDragEventParams): Promise<void>
  dispatchKeyEvent(params: DispatchKeyEventParams): Promise<void>
  insertText(params: InsertTextParams): Promise<void>
  imeSetComposition(params: ImeSetCompositionParams): Promise<void>
  dispatchMouseEvent(params: DispatchMouseEventParams): Promise<void>
  dispatchTouchEvent(params: DispatchTouchEventParams): Promise<void>
  cancelDragging(): Promise<void>
  emulateTouchFromMouseEvent(
    params: EmulateTouchFromMouseEventParams,
  ): Promise<void>
  setIgnoreInputEvents(params: SetIgnoreInputEventsParams): Promise<void>
  setInterceptDrags(params: SetInterceptDragsParams): Promise<void>
  synthesizePinchGesture(params: SynthesizePinchGestureParams): Promise<void>
  synthesizeScrollGesture(params: SynthesizeScrollGestureParams): Promise<void>
  synthesizeTapGesture(params: SynthesizeTapGestureParams): Promise<void>

  // ── Events ──

  on(
    event: 'dragIntercepted',
    handler: (params: DragInterceptedEvent) => void,
  ): () => void
}
