/**
 * @license
 * Copyright 2025 BrowserOS
 */
import { z } from 'zod'
import type { ControllerToolContext } from '../../types/controller-tool-context'
import { ToolCategories } from '../../types/tool-categories'
import { defineTool } from '../../types/tool-definition'
import type { Response } from '../types/response'

async function waitForTabReady(
  context: ControllerToolContext,
  tabId: number,
  windowId?: number,
): Promise<void> {
  // Best-effort: give the tab a moment to load so follow-up tools (snapshot,
  // screenshots, input) don't race a blank/incomplete page.
  for (let i = 0; i < 30; i++) {
    try {
      const status = (await context.controller.executeAction(
        'getPageLoadStatus',
        {
          tabId,
          windowId,
        },
      )) as {
        isResourcesLoading?: boolean
        isDOMContentLoaded?: boolean
        isPageComplete?: boolean
      }
      if (status.isPageComplete || status.isDOMContentLoaded) {
        return
      }
    } catch {
      // Ignore and keep waiting.
    }
    await new Promise((r) => setTimeout(r, 100))
  }
}

export const navigate = defineTool<
  z.ZodRawShape,
  ControllerToolContext,
  Response
>({
  name: 'browser_navigate',
  description: 'Navigate to a URL in the current or specified tab',
  kind: 'controller' as const,
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
  },
  handler: async (request, response, context) => {
    const params = request.params as {
      url: string
      tabId?: number
    }

    const result = await context.controller.executeAction('navigate', params)
    const data = result as {
      tabId: number
      windowId: number
      url: string
      message: string
    }

    await waitForTabReady(context, data.tabId, data.windowId)

    response.appendResponseLine(data.message)
    response.appendResponseLine(`Tab ID: ${data.tabId}`)
    response.appendResponseLine(`Window ID: ${data.windowId}`)

    response.addStructuredContent('tabId', data.tabId)
    response.addStructuredContent('windowId', data.windowId)
    response.addStructuredContent('url', data.url)
    response.setIncludeSnapshot?.(data.tabId)
  },
})
