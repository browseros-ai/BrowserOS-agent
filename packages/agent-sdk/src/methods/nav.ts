import type { AgentContext } from '../context'
import { NavigationError } from '../errors'
import type { NavOptions, NavResult } from '../types'
import { request } from '../utils/request'

export async function nav(
  ctx: AgentContext,
  url: string,
  options?: NavOptions,
): Promise<NavResult> {
  ctx.emit({ type: 'start-step' })
  ctx.emit({ type: 'text-start', id: 'nav' })
  ctx.emit({
    type: 'text-delta',
    id: 'nav',
    delta: `Navigating to ${url}...\n`,
  })

  const windowId = options?.windowId ?? ctx.browserContext?.windowId

  const result = await request<NavResult>(
    ctx,
    '/sdk/nav',
    { url, windowId, tabId: options?.tabId },
    NavigationError,
  )

  ctx.emit({
    type: 'text-delta',
    id: 'nav',
    delta: result.success ? 'Navigation complete.\n' : 'Navigation failed.\n',
  })
  ctx.emit({ type: 'text-end', id: 'nav' })
  ctx.emit({ type: 'finish-step' })

  return result
}
