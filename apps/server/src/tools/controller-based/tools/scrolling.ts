/**
 * @license
 * Copyright 2025 BrowserOS
 */
import { z } from 'zod'
import type { ControllerToolContext } from '../../types/controller-tool-context'
import { ToolCategories } from '../../types/tool-categories'
import { defineTool } from '../../types/tool-definition'
import type { Response } from '../types/response'

export const scrollDown = defineTool<
  z.ZodRawShape,
  ControllerToolContext,
  Response
>({
  name: 'browser_scroll_down',
  description: 'Scroll the page down by one viewport height',
  kind: 'controller' as const,
  annotations: {
    category: ToolCategories.SCROLLING,
    readOnlyHint: false,
  },
  schema: {
    tabId: z.coerce.number().describe('Tab ID to scroll'),
  },
  handler: async (request, response, context) => {
    const { tabId } = request.params as { tabId: number }

    await context.controller.executeAction('scrollDown', { tabId })

    response.appendResponseLine(`Scrolled down in tab ${tabId}`)
  },
})

export const scrollUp = defineTool<
  z.ZodRawShape,
  ControllerToolContext,
  Response
>({
  name: 'browser_scroll_up',
  description: 'Scroll the page up by one viewport height',
  kind: 'controller' as const,
  annotations: {
    category: ToolCategories.SCROLLING,
    readOnlyHint: false,
  },
  schema: {
    tabId: z.coerce.number().describe('Tab ID to scroll'),
  },
  handler: async (request, response, context) => {
    const { tabId } = request.params as { tabId: number }

    await context.controller.executeAction('scrollUp', { tabId })

    response.appendResponseLine(`Scrolled up in tab ${tabId}`)
  },
})
