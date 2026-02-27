import type { z } from 'zod'
import type { Browser } from '../browser/browser'
import { ToolResponse, type ToolResult } from './response'

export interface ToolDefinition {
  name: string
  description: string
  input: z.ZodType
  handler: ToolHandler
}

export type ToolHandler = (
  args: unknown,
  ctx: ToolContext,
  response: ToolResponse,
) => Promise<void>

export type ToolContext = {
  browser: Browser
}

export function defineTool<T extends z.ZodType>(config: {
  name: string
  description: string
  input: T
  handler: (
    args: z.infer<T>,
    ctx: ToolContext,
    response: ToolResponse,
  ) => Promise<void>
}): ToolDefinition {
  return config as ToolDefinition
}

function getNumberField(
  value: Record<string, unknown>,
  key: string,
): number | undefined {
  const candidate = value[key]
  if (typeof candidate !== 'number' || !Number.isFinite(candidate)) {
    return undefined
  }
  return candidate
}

export async function enrichToolInputWithTabId(
  args: unknown,
  browser: Browser,
): Promise<unknown> {
  if (!args || typeof args !== 'object' || Array.isArray(args)) {
    return args
  }

  const input = args as Record<string, unknown>
  if (getNumberField(input, 'tabId') !== undefined) {
    return args
  }

  const pageId =
    getNumberField(input, 'pageId') ?? getNumberField(input, 'page')
  if (pageId === undefined) {
    return args
  }

  const tabId = await browser.resolvePageIdToTabId(pageId)
  if (tabId === undefined) {
    return args
  }

  return { ...input, tabId }
}

export async function executeTool(
  tool: ToolDefinition,
  args: unknown,
  ctx: ToolContext,
  signal: AbortSignal,
): Promise<ToolResult> {
  const response = new ToolResponse()

  if (signal.aborted) {
    response.error('Request was aborted')
    return response.toResult()
  }

  try {
    await tool.handler(args, ctx, response)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    response.error(`Internal error in ${tool.name}: ${message}`)
  }

  return response.build(ctx.browser)
}
