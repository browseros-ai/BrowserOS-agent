/**
 * @license
 * Copyright 2025 BrowserOS
 */
import { z } from 'zod'

import { ToolCategories } from '../../types/tool-categories'
import { defineTool } from '../../types/tool-definition'
import type { Context } from '../types/context'
import type { Response } from '../types/response'

export const navigate = defineTool<z.ZodRawShape, Context, Response>({
  name: 'browser_navigate',
  description: 'Navigate to a URL in the current or specified tab',
  annotations: {
    category: ToolCategories.NAVIGATION_AUTOMATION,
    readOnlyHint: false,
  },
  schema: {
    url: z.string().describe('URL to navigate to (must include protocol)'),
    tabId: z.coerce
      .number()
      .optional()
      .describe('Tab ID to navigate (optional, defaults to active tab)'),
    windowId: z
      .number()
      .optional()
      .describe('Window ID (used when tabId not provided)'),
  },
  handler: async (request, response, context) => {
    const params = request.params as {
      url: string
      tabId?: number
      windowId?: number
    }

    const result = await context.executeAction('navigate', params)
    const data = result as {
      tabId: number
      windowId: number
      url: string
      message: string
    }

    response.appendResponseLine(data.message)
    response.appendResponseLine(`Tab ID: ${data.tabId}`)
    response.appendResponseLine(`Window ID: ${data.windowId}`)

    response.addStructuredContent('tabId', data.tabId)
    response.addStructuredContent('windowId', data.windowId)
    response.addStructuredContent('url', data.url)
  },
})
