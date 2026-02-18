/**
 * @license
 * Copyright 2025 BrowserOS
 */
import { z } from 'zod'

import type { ToolCategories } from './tool-categories'

/**
 * Structure for defining a browser automation tool
 * Now generic to support both CDP and Controller contexts/responses
 */
export interface ToolDefinition<
  Schema extends z.ZodRawShape = z.ZodRawShape,
  // biome-ignore lint/suspicious/noExplicitAny: generic default for flexible tool contexts
  TContext = any,
  // biome-ignore lint/suspicious/noExplicitAny: generic default for flexible tool responses
  TResponse = any,
> {
  name: string
  description: string
  kind: 'cdp' | 'controller'
  annotations: {
    title?: string
    category: ToolCategories | string
    readOnlyHint: boolean
    conditions?: string[]
  }
  schema: Schema
  handler: (
    request: Request<Schema>,
    response: TResponse,
    context: TContext,
  ) => Promise<void>
}

/**
 * Request structure with validated parameters
 */
export interface Request<Schema extends z.ZodRawShape> {
  params: z.infer<z.ZodObject<Schema>>
}

/**
 * Helper function for defining tools with type safety
 * Now generic to support both CDP and Controller contexts/responses
 */
export function defineTool<
  Schema extends z.ZodRawShape,
  // biome-ignore lint/suspicious/noExplicitAny: generic default for flexible tool contexts
  TContext = any,
  // biome-ignore lint/suspicious/noExplicitAny: generic default for flexible tool responses
  TResponse = any,
>(
  definition: ToolDefinition<Schema, TContext, TResponse>,
): ToolDefinition<Schema, TContext, TResponse> {
  return definition
}

/**
 * Common schema fragments
 */
export const commonSchemas = {
  timeout: {
    timeout: z
      .number()
      .int()
      .optional()
      .describe(
        'Maximum wait time in milliseconds. If set to 0, the default timeout will be used.',
      )
      .transform((value: number | undefined) => {
        return value && value <= 0 ? undefined : value
      }),
  },
  cdpTarget: {
    tabId: z.coerce
      .number()
      .optional()
      .describe('Tab ID to target. Use list_pages to see available tabs.'),
  },
} as const

/**
 * Common error messages
 */
export const ERRORS = {
  CLOSE_PAGE:
    'The last open page cannot be closed. It is fine to keep it open.',
  NO_DIALOG: 'No open dialog found',
  NAVIGATION_FAILED: 'Unable to navigate in currently selected page.',
} as const
