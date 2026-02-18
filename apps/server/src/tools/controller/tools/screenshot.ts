/**
 * @license
 * Copyright 2025 BrowserOS
 */
import { z } from 'zod'
import type { ControllerToolContext } from '../../types/controller-tool-context'
import { ToolCategories } from '../../types/tool-categories'
import { defineTool } from '../../types/tool-definition'
import type { Response } from '../types/response'
import { parseDataUrl } from '../utils/parse-data-url'

export const getScreenshotPointer = defineTool<
  z.ZodRawShape,
  ControllerToolContext,
  Response
>({
  name: 'browser_get_screenshot_pointer',
  description:
    'Capture a screenshot with a pointer overlay on a specific element',
  kind: 'controller' as const,
  annotations: {
    category: ToolCategories.SCREENSHOTS,
    readOnlyHint: true,
  },
  schema: {
    tabId: z.coerce.number().describe('Tab ID to capture'),
    nodeId: z.coerce
      .number()
      .int()
      .positive()
      .describe('Node ID to show pointer over'),
    size: z
      .enum(['small', 'medium', 'large'])
      .optional()
      .describe(
        'Screenshot size preset (small: 512px, medium: 768px, large: 1028px)',
      ),
    pointerLabel: z
      .string()
      .optional()
      .describe('Optional label to show with pointer (e.g., "Click", "Type")'),
  },
  handler: async (request, response, context) => {
    const params = request.params as {
      tabId: number
      nodeId: number
      size?: string
      pointerLabel?: string
    }

    const result = await context.controller.executeAction(
      'captureScreenshotPointer',
      params,
    )
    const { dataUrl, pointerPosition } = result as {
      dataUrl: string
      pointerPosition?: { x: number; y: number }
    }

    const { mimeType, data } = parseDataUrl(dataUrl)

    response.attachImage({ mimeType, data })

    if (pointerPosition) {
      response.appendResponseLine(
        `Screenshot captured with pointer at (${pointerPosition.x}, ${pointerPosition.y}) for node ${params.nodeId}`,
      )
    } else {
      response.appendResponseLine(
        `Screenshot captured for node ${params.nodeId} (pointer position not available)`,
      )
    }
  },
})

export const getScreenshot = defineTool<
  z.ZodRawShape,
  ControllerToolContext,
  Response
>({
  name: 'browser_get_screenshot',
  description: 'Capture a screenshot of the page',
  kind: 'controller' as const,
  annotations: {
    category: ToolCategories.SCREENSHOTS,
    readOnlyHint: true,
  },
  schema: {
    tabId: z.coerce.number().describe('Tab ID to capture'),
    size: z
      .enum(['small', 'medium', 'large'])
      .optional()
      .describe(
        'Screenshot size preset (small: 512px, medium: 768px, large: 1028px)',
      ),
    showHighlights: z
      .boolean()
      .optional()
      .describe('Show element highlights in screenshot'),
    width: z.coerce
      .number()
      .optional()
      .describe('Exact width in pixels (overrides size)'),
    height: z.coerce
      .number()
      .optional()
      .describe('Exact height in pixels (overrides size)'),
  },
  handler: async (request, response, context) => {
    const params = request.params as {
      tabId: number
      size?: string
      showHighlights?: boolean
      width?: number
      height?: number
    }

    const result = await context.controller.executeAction(
      'captureScreenshot',
      params,
    )
    const { dataUrl } = result as { dataUrl: string }

    const { mimeType, data } = parseDataUrl(dataUrl)

    response.attachImage({ mimeType, data })
    response.appendResponseLine(`Screenshot captured from tab ${params.tabId}`)
  },
})
