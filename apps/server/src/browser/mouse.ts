import type { ProtocolApi } from '@browseros/cdp-protocol/protocol-api'

export async function dispatchClick(
  session: ProtocolApi,
  x: number,
  y: number,
  button: string,
  clickCount: number,
  modifiers: number,
): Promise<void> {
  const btn = button as 'left' | 'middle' | 'right'
  await session.Input.dispatchMouseEvent({ type: 'mouseMoved', x, y })
  await session.Input.dispatchMouseEvent({
    type: 'mousePressed',
    x,
    y,
    button: btn,
    clickCount,
    modifiers,
  })
  await session.Input.dispatchMouseEvent({
    type: 'mouseReleased',
    x,
    y,
    button: btn,
    clickCount,
    modifiers,
  })
}

export async function dispatchHover(
  session: ProtocolApi,
  x: number,
  y: number,
): Promise<void> {
  await session.Input.dispatchMouseEvent({ type: 'mouseMoved', x, y })
}

export async function dispatchDrag(
  session: ProtocolApi,
  from: { x: number; y: number },
  to: { x: number; y: number },
): Promise<void> {
  await session.Input.dispatchMouseEvent({
    type: 'mouseMoved',
    x: from.x,
    y: from.y,
  })
  await session.Input.dispatchMouseEvent({
    type: 'mousePressed',
    x: from.x,
    y: from.y,
    button: 'left',
    clickCount: 1,
  })
  await session.Input.dispatchMouseEvent({
    type: 'mouseMoved',
    x: to.x,
    y: to.y,
  })
  await session.Input.dispatchMouseEvent({
    type: 'mouseReleased',
    x: to.x,
    y: to.y,
    button: 'left',
    clickCount: 1,
  })
}

export async function dispatchScroll(
  session: ProtocolApi,
  x: number,
  y: number,
  deltaX: number,
  deltaY: number,
): Promise<void> {
  await session.Input.dispatchMouseEvent({
    type: 'mouseWheel',
    x,
    y,
    deltaX,
    deltaY,
  })
}
