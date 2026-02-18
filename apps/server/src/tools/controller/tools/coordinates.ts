/**
 * @license
 * Copyright 2025 BrowserOS
 */
import { z } from 'zod'
import type { ControllerToolContext } from '../../types/controller-tool-context'
import { ToolCategories } from '../../types/tool-categories'
import { defineTool } from '../../types/tool-definition'
import type { Response } from '../types/response'

export const clickCoordinates = defineTool<
  z.ZodRawShape,
  ControllerToolContext,
  Response
>({
  name: 'browser_click_coordinates',
  description: 'Click at specific X,Y coordinates on the page',
  kind: 'controller' as const,
  annotations: {
    category: ToolCategories.COORDINATES,
    readOnlyHint: false,
  },
  schema: {
    tabId: z.coerce.number().describe('Tab ID to click in'),
    x: z.coerce.number().describe('X coordinate'),
    y: z.coerce.number().describe('Y coordinate'),
  },
  handler: async (request, response, context) => {
    const { tabId, x, y } = request.params as {
      tabId: number
      x: number
      y: number
    }

    await context.controller.executeAction('clickCoordinates', { tabId, x, y })

    response.appendResponseLine(
      `Clicked at coordinates (${x}, ${y}) in tab ${tabId}`,
    )
  },
})

export const typeAtCoordinates = defineTool<
  z.ZodRawShape,
  ControllerToolContext,
  Response
>({
  name: 'browser_type_at_coordinates',
  description: 'Click at coordinates and type text',
  kind: 'controller' as const,
  annotations: {
    category: ToolCategories.COORDINATES,
    readOnlyHint: false,
  },
  schema: {
    tabId: z.coerce.number().describe('Tab ID to type in'),
    x: z.coerce.number().describe('X coordinate'),
    y: z.coerce.number().describe('Y coordinate'),
    text: z.string().describe('Text to type'),
  },
  handler: async (request, response, context) => {
    const { tabId, x, y, text } = request.params as {
      tabId: number
      x: number
      y: number
      text: string
    }

    await context.controller.executeAction('typeAtCoordinates', {
      tabId,
      x,
      y,
      text,
    })

    response.appendResponseLine(
      `Clicked at (${x}, ${y}) and typed text in tab ${tabId}`,
    )
  },
})
