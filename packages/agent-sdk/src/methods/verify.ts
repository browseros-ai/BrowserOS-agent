import type { AgentContext } from '../context'
import { VerificationError } from '../errors'
import type { VerifyOptions, VerifyResult } from '../types'
import { request } from '../utils/request'

export async function verify(
  ctx: AgentContext,
  expectation: string,
  options?: VerifyOptions,
): Promise<VerifyResult> {
  ctx.emit({ type: 'start-step' })
  ctx.emit({ type: 'text-start', id: 'verify' })
  ctx.emit({
    type: 'text-delta',
    id: 'verify',
    delta: `Verifying: ${expectation}...\n`,
  })

  const result = await request<VerifyResult>(
    ctx,
    '/sdk/verify',
    {
      expectation,
      context: options?.context,
      windowId: ctx.browserContext?.windowId,
      llm: ctx.llmConfig,
    },
    VerificationError,
  )

  ctx.emit({
    type: 'text-delta',
    id: 'verify',
    delta: result.success
      ? `Verification passed: ${result.reason}\n`
      : `Verification failed: ${result.reason}\n`,
  })
  ctx.emit({ type: 'text-end', id: 'verify' })
  ctx.emit({ type: 'finish-step' })

  return result
}

/**
 * Internal verify for act() retry loop - no UI events emitted
 */
export async function verifyInternal(
  ctx: AgentContext,
  expectation: string,
): Promise<VerifyResult> {
  return request<VerifyResult>(
    ctx,
    '/sdk/verify',
    {
      expectation,
      windowId: ctx.browserContext?.windowId,
      llm: ctx.llmConfig,
    },
    VerificationError,
  )
}
