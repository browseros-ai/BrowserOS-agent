import type { CdpBackend } from './backends/types'

export async function dispatchClick(
  cdp: CdpBackend,
  sessionId: string,
  x: number,
  y: number,
  button: string,
  clickCount: number,
  modifiers: number,
): Promise<void> {
  await cdp.send(
    'Input.dispatchMouseEvent',
    { type: 'mouseMoved', x, y },
    sessionId,
  )
  await cdp.send(
    'Input.dispatchMouseEvent',
    { type: 'mousePressed', x, y, button, clickCount, modifiers },
    sessionId,
  )
  await cdp.send(
    'Input.dispatchMouseEvent',
    { type: 'mouseReleased', x, y, button, clickCount, modifiers },
    sessionId,
  )
}

export async function dispatchHover(
  cdp: CdpBackend,
  sessionId: string,
  x: number,
  y: number,
): Promise<void> {
  await cdp.send(
    'Input.dispatchMouseEvent',
    { type: 'mouseMoved', x, y },
    sessionId,
  )
}

export async function dispatchDrag(
  cdp: CdpBackend,
  sessionId: string,
  from: { x: number; y: number },
  to: { x: number; y: number },
): Promise<void> {
  await cdp.send(
    'Input.dispatchMouseEvent',
    { type: 'mouseMoved', x: from.x, y: from.y },
    sessionId,
  )
  await cdp.send(
    'Input.dispatchMouseEvent',
    {
      type: 'mousePressed',
      x: from.x,
      y: from.y,
      button: 'left',
      clickCount: 1,
    },
    sessionId,
  )
  await cdp.send(
    'Input.dispatchMouseEvent',
    { type: 'mouseMoved', x: to.x, y: to.y },
    sessionId,
  )
  await cdp.send(
    'Input.dispatchMouseEvent',
    {
      type: 'mouseReleased',
      x: to.x,
      y: to.y,
      button: 'left',
      clickCount: 1,
    },
    sessionId,
  )
}

export async function dispatchScroll(
  cdp: CdpBackend,
  sessionId: string,
  x: number,
  y: number,
  deltaX: number,
  deltaY: number,
): Promise<void> {
  await cdp.send(
    'Input.dispatchMouseEvent',
    { type: 'mouseWheel', x, y, deltaX, deltaY },
    sessionId,
  )
}
