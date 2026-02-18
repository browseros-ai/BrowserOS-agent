/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { logger } from '../../../browser/cdp/logger'
import { ToolCategories } from '../../types/tool-categories'
import type { Dialog } from '../third-party'
import { zod } from '../third-party'
import type { CdpToolContext } from '../types/cdp-tool-context'
import {
  CLOSE_PAGE_ERROR,
  commonSchemas,
  defineTool,
  timeoutSchema,
} from '../types/cdp-tool-definition'

function resolveSelectedPageId(context: CdpToolContext): number {
  const page = context.cdp.getSelectedPage()
  const target = page.target() as { targetId?: string; _targetId?: string }
  const targetId = target.targetId ?? target._targetId
  if (!targetId) {
    throw new Error('Failed to resolve selected page target ID.')
  }

  const entry = context.registry.getByTargetId(targetId)
  if (!entry) {
    throw new Error('Selected page is not registered. Call list_pages first.')
  }

  return entry.pageId
}

export const listPages = defineTool({
  name: 'list_pages',
  description: `Get a list of pages open in the browser.`,
  kind: 'cdp' as const,
  annotations: {
    category: ToolCategories.NAVIGATION_AUTOMATION,
    readOnlyHint: true,
  },
  schema: {
    ...commonSchemas.cdpTarget,
  },
  handler: async (_request, response) => {
    response.setIncludePages(true)
  },
})

export const closePage = defineTool({
  name: 'close_page',
  description: `Closes the selected page. The last open page cannot be closed.`,
  kind: 'cdp' as const,
  annotations: {
    category: ToolCategories.NAVIGATION_AUTOMATION,
    readOnlyHint: false,
  },
  schema: {
    ...commonSchemas.cdpTarget,
  },
  handler: async (_request, response, context) => {
    const pageId = resolveSelectedPageId(context)

    try {
      await context.cdp.closePage(pageId)
      context.state.clearSnapshot(pageId)
    } catch (error) {
      if (error instanceof Error && error.message === CLOSE_PAGE_ERROR) {
        response.appendResponseLine(error.message)
        response.setIncludePages(true)
        return
      }
      throw error
    }

    const nextEntry = context.registry.entries()[0]
    if (nextEntry) {
      context.state.setActive(nextEntry.pageId)
      if (nextEntry.page) {
        context.cdp.selectPage(nextEntry.page)
      }
    } else {
      context.state.clearActive()
    }

    response.setIncludePages(true)
  },
})

export const newPage = defineTool({
  name: 'new_page',
  description: `Creates a new page`,
  kind: 'cdp' as const,
  annotations: {
    category: ToolCategories.NAVIGATION_AUTOMATION,
    readOnlyHint: false,
  },
  schema: {
    ...commonSchemas.cdpTarget,
    url: zod.string().describe('URL to load in a new page.'),
    background: zod
      .boolean()
      .optional()
      .describe(
        'Whether to open the page in the background without bringing it to the front. Default is false (foreground).',
      ),
    ...timeoutSchema,
  },
  handler: async (request, response, context) => {
    const page = await context.cdp.newPage(request.params.background)

    await context.cdp.withPage(page, async () => {
      await context.cdp.waitForEventsAfterAction(
        async () => {
          await page.goto(request.params.url, {
            timeout: request.params.timeout,
          })
        },
        { timeout: request.params.timeout },
      )
    })

    const target = page.target() as { targetId?: string; _targetId?: string }
    const targetId = target.targetId ?? target._targetId
    if (targetId) {
      const entry = context.registry.getByTargetId(targetId)
      if (entry) {
        context.state.setActive(entry.pageId)
      }
    }

    response.setIncludePages(true)
  },
})

export const navigatePage = defineTool({
  name: 'navigate_page',
  description: `Navigates the currently selected page to a URL.`,
  kind: 'cdp' as const,
  annotations: {
    category: ToolCategories.NAVIGATION_AUTOMATION,
    readOnlyHint: false,
  },
  schema: {
    ...commonSchemas.cdpTarget,
    type: zod
      .enum(['url', 'back', 'forward', 'reload'])
      .optional()
      .describe(
        'Navigate the page by URL, back or forward in history, or reload.',
      ),
    url: zod.string().optional().describe('Target URL (only type=url)'),
    ignoreCache: zod
      .boolean()
      .optional()
      .describe('Whether to ignore cache on reload.'),
    handleBeforeUnload: zod
      .enum(['accept', 'decline'])
      .optional()
      .describe(
        'Whether to auto accept or beforeunload dialogs triggered by this navigation. Default is accept.',
      ),
    initScript: zod
      .string()
      .optional()
      .describe(
        'A JavaScript script to be executed on each new document before any other scripts for the next navigation.',
      ),
    ...timeoutSchema,
  },
  handler: async (request, response, context) => {
    const page = context.cdp.getSelectedPage()
    const options = {
      timeout: request.params.timeout,
    }

    if (!request.params.type && !request.params.url) {
      throw new Error('Either URL or a type is required.')
    }

    if (!request.params.type) {
      request.params.type = 'url'
    }

    const handleBeforeUnload = request.params.handleBeforeUnload ?? 'accept'
    const dialogHandler = (dialog: Dialog) => {
      if (dialog.type() === 'beforeunload') {
        if (handleBeforeUnload === 'accept') {
          response.appendResponseLine(`Accepted a beforeunload dialog.`)
          void dialog.accept()
        } else {
          response.appendResponseLine(`Declined a beforeunload dialog.`)
          void dialog.dismiss()
        }
        context.cdp.clearDialog()
      }
    }

    let initScriptId: string | undefined
    if (request.params.initScript) {
      const { identifier } = await page.evaluateOnNewDocument(
        request.params.initScript,
      )
      initScriptId = identifier
    }

    page.on('dialog', dialogHandler)

    try {
      await context.cdp.waitForEventsAfterAction(
        // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: navigation switch
        async () => {
          switch (request.params.type) {
            case 'url':
              if (!request.params.url) {
                throw new Error('A URL is required for navigation of type=url.')
              }
              try {
                await page.goto(request.params.url, options)
                response.appendResponseLine(
                  `Successfully navigated to ${request.params.url}.`,
                )
              } catch (error) {
                response.appendResponseLine(
                  `Unable to navigate in the selected page: ${error instanceof Error ? error.message : String(error)}.`,
                )
              }
              break
            case 'back':
              try {
                await page.goBack(options)
                response.appendResponseLine(
                  `Successfully navigated back to ${page.url()}.`,
                )
              } catch (error) {
                response.appendResponseLine(
                  `Unable to navigate back in the selected page: ${error instanceof Error ? error.message : String(error)}.`,
                )
              }
              break
            case 'forward':
              try {
                await page.goForward(options)
                response.appendResponseLine(
                  `Successfully navigated forward to ${page.url()}.`,
                )
              } catch (error) {
                response.appendResponseLine(
                  `Unable to navigate forward in the selected page: ${error instanceof Error ? error.message : String(error)}.`,
                )
              }
              break
            case 'reload':
              try {
                if (request.params.ignoreCache) {
                  const client = await page.target().createCDPSession()
                  try {
                    await client.send('Network.setCacheDisabled', {
                      cacheDisabled: true,
                    })
                    await page.reload(options)
                  } finally {
                    await client
                      .send('Network.setCacheDisabled', {
                        cacheDisabled: false,
                      })
                      .catch(() => {})
                    await client.detach().catch(() => {})
                  }
                } else {
                  await page.reload(options)
                }
                response.appendResponseLine(`Successfully reloaded the page.`)
              } catch (error) {
                response.appendResponseLine(
                  `Unable to reload the selected page: ${error instanceof Error ? error.message : String(error)}.`,
                )
              }
              break
          }
        },
        { timeout: request.params.timeout },
      )
    } finally {
      page.off('dialog', dialogHandler)
      if (initScriptId) {
        await page
          .removeScriptToEvaluateOnNewDocument(initScriptId)
          .catch((error) => {
            logger('Failed to remove init script', error)
          })
      }
    }

    response.setIncludePages(true)
  },
})

export const resizePage = defineTool({
  name: 'resize_page',
  description: `Resizes the selected page's window so that the page has specified dimension`,
  kind: 'cdp' as const,
  annotations: {
    category: ToolCategories.EMULATION,
    readOnlyHint: false,
  },
  schema: {
    ...commonSchemas.cdpTarget,
    width: zod.number().describe('Page width'),
    height: zod.number().describe('Page height'),
  },
  handler: async (request, response, context) => {
    const page = context.cdp.getSelectedPage()
    await page.setViewport({
      width: request.params.width,
      height: request.params.height,
    })

    response.setIncludePages(true)
  },
})

export const handleDialog = defineTool({
  name: 'handle_dialog',
  description: `If a browser dialog was opened, use this command to handle it`,
  kind: 'cdp' as const,
  annotations: {
    category: ToolCategories.INPUT_AUTOMATION,
    readOnlyHint: false,
  },
  schema: {
    ...commonSchemas.cdpTarget,
    action: zod
      .enum(['accept', 'dismiss'])
      .describe('Whether to dismiss or accept the dialog'),
    promptText: zod
      .string()
      .optional()
      .describe('Optional prompt text to enter into the dialog.'),
  },
  handler: async (request, response, context) => {
    const dialog = context.cdp.getDialog()
    if (!dialog) {
      throw new Error('No open dialog found')
    }

    switch (request.params.action) {
      case 'accept': {
        try {
          await dialog.accept(request.params.promptText)
        } catch (error) {
          logger(error)
        }
        response.appendResponseLine('Successfully accepted the dialog')
        break
      }
      case 'dismiss': {
        try {
          await dialog.dismiss()
        } catch (error) {
          logger(error)
        }
        response.appendResponseLine('Successfully dismissed the dialog')
        break
      }
    }

    context.cdp.clearDialog()
    response.setIncludePages(true)
  },
})
