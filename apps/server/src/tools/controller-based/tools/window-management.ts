/**
 * @license
 * Copyright 2025 BrowserOS
 */
import { z } from 'zod'

import { ToolCategories } from '../../types/tool-categories'
import { defineTool } from '../../types/tool-definition'
import type { Context } from '../types/context'
import type { Response } from '../types/response'

export const createWindow = defineTool<z.ZodRawShape, Context, Response>({
  name: 'browser_create_window',
  description:
    'Create a new browser window. Returns the windowId and tabId of the created window.',
  annotations: {
    category: ToolCategories.TAB_MANAGEMENT,
    readOnlyHint: false,
  },
  schema: {
    url: z
      .string()
      .optional()
      .describe('URL to open in the new window. Defaults to about:blank'),
    incognito: z.boolean().optional().describe('Create an incognito window'),
    focused: z
      .boolean()
      .optional()
      .describe('Whether to focus the new window. Defaults to true'),
  },
  handler: async (request, response, context) => {
    const params = request.params as {
      url?: string
      incognito?: boolean
      focused?: boolean
    }

    const result = await context.executeAction('createWindow', {
      url: params.url || 'about:blank',
      incognito: params.incognito || false,
      focused: params.focused ?? true,
    })
    const data = result as { windowId: number; tabId: number }

    response.appendResponseLine(`Created window ${data.windowId}`)
    response.appendResponseLine(`Tab ID: ${data.tabId}`)

    response.addStructuredContent('windowId', data.windowId)
    response.addStructuredContent('tabId', data.tabId)
  },
})

export const closeWindow = defineTool<z.ZodRawShape, Context, Response>({
  name: 'browser_close_window',
  description: 'Close a browser window by its windowId.',
  annotations: {
    category: ToolCategories.TAB_MANAGEMENT,
    readOnlyHint: false,
  },
  schema: {
    windowId: z.coerce.number().describe('The ID of the window to close'),
  },
  handler: async (request, response, context) => {
    const { windowId } = request.params as { windowId: number }

    await context.executeAction('closeWindow', { windowId })

    response.appendResponseLine(`Closed window ${windowId}`)
  },
})
