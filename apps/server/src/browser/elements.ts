import type { CdpBackend } from './backends/types'

function quadCenter(q: number[]): { x: number; y: number } {
  const x = ((q[0] ?? 0) + (q[2] ?? 0) + (q[4] ?? 0) + (q[6] ?? 0)) / 4
  const y = ((q[1] ?? 0) + (q[3] ?? 0) + (q[5] ?? 0) + (q[7] ?? 0)) / 4
  return { x, y }
}

/** 3-tier fallback: getContentQuads -> getBoxModel -> getBoundingClientRect */
export async function getElementCenter(
  cdp: CdpBackend,
  backendNodeId: number,
  sessionId: string,
): Promise<{ x: number; y: number }> {
  try {
    const quadsResult = (await cdp.send(
      'DOM.getContentQuads',
      { backendNodeId },
      sessionId,
    )) as {
      quads?: number[][]
    }
    if (quadsResult.quads?.length) {
      const q = quadsResult.quads[0]
      if (q && q.length >= 8) return quadCenter(q)
    }
  } catch {
    // fall through
  }

  try {
    const boxResult = (await cdp.send(
      'DOM.getBoxModel',
      { backendNodeId },
      sessionId,
    )) as {
      model?: { content: number[] }
    }
    const content = boxResult.model?.content
    if (content && content.length >= 8) return quadCenter(content)
  } catch {
    // fall through
  }

  const resolved = (await cdp.send(
    'DOM.resolveNode',
    { backendNodeId },
    sessionId,
  )) as {
    object?: { objectId?: string }
  }
  const objectId = resolved.object?.objectId
  if (!objectId) {
    throw new Error(
      'Could not resolve element — it may have been removed from the page.',
    )
  }

  const boundsResult = (await cdp.send(
    'Runtime.callFunctionOn',
    {
      functionDeclaration:
        'function(){var r=this.getBoundingClientRect();return{x:r.left,y:r.top,w:r.width,h:r.height}}',
      objectId,
      returnByValue: true,
    },
    sessionId,
  )) as {
    result?: {
      value?: { x: number; y: number; w: number; h: number }
    }
  }

  const rect = boundsResult.result?.value
  if (!rect) throw new Error('Could not get element bounds.')
  return { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 }
}

export async function scrollIntoView(
  cdp: CdpBackend,
  backendNodeId: number,
  sessionId: string,
): Promise<void> {
  try {
    await cdp.send('DOM.scrollIntoViewIfNeeded', { backendNodeId }, sessionId)
  } catch {
    // not critical
  }
}

export async function focusElement(
  cdp: CdpBackend,
  backendNodeId: number,
  sessionId: string,
): Promise<void> {
  const pushResult = (await cdp.send(
    'DOM.pushNodesByBackendIdsToFrontend',
    { backendNodeIds: [backendNodeId] },
    sessionId,
  )) as { nodeIds: number[] }
  await cdp.send('DOM.focus', { nodeId: pushResult.nodeIds[0] }, sessionId)
}

export async function jsClick(
  cdp: CdpBackend,
  backendNodeId: number,
  sessionId: string,
): Promise<void> {
  const objectId = await resolveObjectId(cdp, backendNodeId, sessionId)
  await cdp.send(
    'Runtime.callFunctionOn',
    { functionDeclaration: 'function(){this.click()}', objectId },
    sessionId,
  )
}

export async function resolveObjectId(
  cdp: CdpBackend,
  backendNodeId: number,
  sessionId: string,
): Promise<string> {
  const resolved = (await cdp.send(
    'DOM.resolveNode',
    { backendNodeId },
    sessionId,
  )) as {
    object?: { objectId?: string }
  }
  const objectId = resolved.object?.objectId
  if (!objectId)
    throw new Error('Element not found in DOM. Take a new snapshot.')
  return objectId
}

export async function callOnElement(
  cdp: CdpBackend,
  backendNodeId: number,
  sessionId: string,
  fn: string,
  args?: unknown[],
): Promise<unknown> {
  const objectId = await resolveObjectId(cdp, backendNodeId, sessionId)
  const params: Record<string, unknown> = {
    functionDeclaration: fn,
    objectId,
    returnByValue: true,
  }
  if (args) params.arguments = args.map((v) => ({ value: v }))
  const result = (await cdp.send(
    'Runtime.callFunctionOn',
    params,
    sessionId,
  )) as {
    result?: { value?: unknown }
  }
  return result.result?.value
}
