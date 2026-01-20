import type { AgentContext } from '../context'
import { ActionError, ConnectionError } from '../errors'
import type { ActOptions, ActResult } from '../types'
import { parseSSEStream } from '../utils/sse-parser'
import { verifyInternal } from './verify'

/**
 * Execute the action via SSE stream
 */
async function executeAct(
  ctx: AgentContext,
  instruction: string,
  options?: ActOptions,
): Promise<ActResult> {
  ctx.throwIfAborted()

  const url = `${ctx.baseUrl}/sdk/act`

  const browserContextForAct = ctx.browserContext
    ? {
        windowId: ctx.browserContext.windowId,
        enabledMcpServers: ctx.browserContext.enabledMcpServers,
        customMcpServers: ctx.browserContext.customMcpServers,
      }
    : undefined

  let response: Response
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        instruction,
        context: options?.context,
        maxSteps: options?.maxSteps,
        browserContext: browserContextForAct,
        llm: ctx.llmConfig,
        sessionId: ctx.sessionId,
      }),
      signal: ctx.signal,
    })
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Operation aborted')
    }
    throw new ConnectionError(
      `Failed to connect to server: ${error instanceof Error ? error.message : String(error)}`,
      url,
    )
  }

  if (!response.ok) {
    let errorMessage = `Request failed with status ${response.status}`
    try {
      const errorBody = await response.json()
      if (errorBody.error?.message) {
        errorMessage = errorBody.error.message
      }
    } catch {
      // Use default error message
    }
    throw new ActionError(errorMessage, response.status)
  }

  const reader = response.body?.getReader()
  const result: ActResult = { success: true, steps: [] }

  if (reader) {
    await parseSSEStream(ctx, reader, result)
  }

  return result
}

export async function act(
  ctx: AgentContext,
  instruction: string,
  options?: ActOptions,
): Promise<ActResult> {
  // Handle resetState on first call only
  if (options?.resetState && ctx.stateful) {
    ctx.sessionId = crypto.randomUUID()
  }

  // No verification - just execute
  if (!options?.verify) {
    return executeAct(ctx, instruction, options)
  }

  // With verification: execute + verify + retry loop
  const maxRetries = options.maxRetries ?? 1
  let lastResult: ActResult | null = null
  let lastVerifyReason: string | undefined

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    // On retry, include the verification failure in the instruction
    const retryInstruction =
      attempt === 0 || !lastVerifyReason
        ? instruction
        : `${instruction}\n\n[Previous attempt failed verification: "${lastVerifyReason}"]`

    // Don't reset state on retries - let agent see previous context
    const attemptOptions =
      attempt === 0 ? options : { ...options, resetState: false }

    lastResult = await executeAct(ctx, retryInstruction, attemptOptions)

    // Action failed - no point verifying
    if (!lastResult.success) {
      return lastResult
    }

    // Verify the result
    const verifyResult = await verifyInternal(ctx, options.verify)

    if (verifyResult.success) {
      return lastResult
    }

    lastVerifyReason = verifyResult.reason

    // Emit retry info if more attempts remain
    if (attempt < maxRetries) {
      ctx.emit({
        type: 'text-delta',
        id: 'act-retry',
        delta: `Verification failed: ${verifyResult.reason}. Retrying (${attempt + 1}/${maxRetries})...\n`,
      })
    }
  }

  // All retries exhausted - verification failed
  return {
    success: false,
    steps: lastResult?.steps ?? [],
  }
}
