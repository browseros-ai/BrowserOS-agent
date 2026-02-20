import type { z } from 'zod'
import type { Browser } from '../../browser/browser'
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

export async function executeTool(
  tool: ToolDefinition,
  args: unknown,
  ctx: ToolContext,
): Promise<ToolResult> {
  const response = new ToolResponse()

  try {
    await tool.handler(args, ctx, response)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    response.error(`Internal error in ${tool.name}: ${message}`)
  }

  return response.toResult()
}
