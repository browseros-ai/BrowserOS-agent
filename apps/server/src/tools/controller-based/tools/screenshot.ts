/**
 * @license
 * Copyright 2025 BrowserOS
 */
import { z } from 'zod'

import { ToolCategories } from '../../types/tool-categories'
import { defineTool } from '../../types/tool-definition'
import type { Context } from '../types/context'
import type { Response } from '../types/response'
import { parseDataUrl } from '../utils/parse-data-url'

export const getScreenshotPointer = defineTool<
  z.ZodRawShape,
  Context,
  Response
>({
  name: 'browser_get_screenshot_pointer',
  description:
    'Capture a screenshot with a pointer overlay on a specific element',
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
    const rawParams = request.params as {
      tabId: number
      nodeId: number
      size?: string
      pointerLabel?: string
    }

    let result: unknown
    try {
      result = await context.executeAction(
        'captureScreenshotPointer',
        rawParams,
      )
    } catch (_error) {
      // Sometimes require the tab/window to be active/visible for capture.
      // Best-effort: activate the tab, then retry using the active windowId.
      await context.executeAction('switchTab', {
        tabId: rawParams.tabId,
        windowId: rawParams.windowId,
      })
      const active = (await context.executeAction('getActiveTab', {})) as {
        windowId: number
      }
      result = await context.executeAction('captureScreenshotPointer', {
        ...rawParams,
        windowId: active.windowId,
      })
    }
    const { dataUrl, pointerPosition } = result as {
      dataUrl: string
      pointerPosition?: { x: number; y: number }
    }

    // Parse data URL to extract MIME type and base64 data
    const { mimeType, data } = parseDataUrl(dataUrl)

    // Attach image to response
    response.attachImage({ mimeType, data })

    if (pointerPosition) {
      response.appendResponseLine(
        `Screenshot captured with pointer at (${pointerPosition.x}, ${pointerPosition.y}) for node ${
          (rawParams as { nodeId: number }).nodeId
        }`,
      )
    } else {
      response.appendResponseLine(
        `Screenshot captured for node ${
          (rawParams as { nodeId: number }).nodeId
        } (pointer position not available)`,
      )
    }
  },
})

export const getScreenshot = defineTool<z.ZodRawShape, Context, Response>({
  name: 'browser_get_screenshot',
  description: 'Capture a screenshot of the page',
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
    const rawParams = request.params as {
      tabId: number
      size?: string
      showHighlights?: boolean
      width?: number
      height?: number
    }

    let result: unknown
    try {
      result = await context.executeAction('captureScreenshot', rawParams)
    } catch (_error) {
      // Some BrowserOS builds require the tab/window to be active/visible for capture.
      // Best-effort: activate the tab, then retry using the active windowId.
      await context.executeAction('switchTab', {
        tabId: rawParams.tabId,
        windowId: rawParams.windowId,
      })
      const active = (await context.executeAction('getActiveTab', {})) as {
        windowId: number
      }
      result = await context.executeAction('captureScreenshot', {
        ...rawParams,
        windowId: active.windowId,
      })
    }
    const { dataUrl } = result as { dataUrl: string }

    // Parse data URL to extract MIME type and base64 data
    const { mimeType, data } = parseDataUrl(dataUrl)

    // Attach image to response
    response.attachImage({ mimeType, data })
    response.appendResponseLine(
      `Screenshot captured from tab ${(rawParams as { tabId: number }).tabId}`,
    )
  },
})
