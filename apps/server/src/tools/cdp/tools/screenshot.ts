/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { ToolCategories } from '../../types/tool-categories'
import type { ElementHandle, Page } from '../third-party'
import { zod } from '../third-party'
import { commonSchemas, defineTool } from '../types/cdp-tool-definition'

export const screenshot = defineTool({
  name: 'take_screenshot',
  description: `Take a screenshot of the page or element.`,
  kind: 'cdp' as const,
  annotations: {
    category: ToolCategories.DEBUGGING,
    readOnlyHint: false,
  },
  schema: {
    ...commonSchemas.cdpTarget,
    format: zod
      .enum(['png', 'jpeg', 'webp'])
      .default('png')
      .describe('Type of format to save the screenshot as. Default is "png"'),
    quality: zod
      .number()
      .min(0)
      .max(100)
      .optional()
      .describe(
        'Compression quality for JPEG and WebP formats (0-100). Higher values mean better quality but larger file sizes. Ignored for PNG format.',
      ),
    uid: zod
      .string()
      .optional()
      .describe(
        'The uid of an element on the page from the page content snapshot. If omitted takes a pages screenshot.',
      ),
    fullPage: zod
      .boolean()
      .optional()
      .describe(
        'If set to true takes a screenshot of the full page instead of the currently visible viewport. Incompatible with uid.',
      ),
    filePath: zod
      .string()
      .optional()
      .describe(
        'The absolute path, or a path relative to the current working directory, to save the screenshot to instead of attaching it to the response.',
      ),
  },
  handler: async (request, response, context) => {
    if (request.params.uid && request.params.fullPage) {
      throw new Error('Providing both "uid" and "fullPage" is not allowed.')
    }

    let pageOrHandle: Page | ElementHandle
    if (request.params.uid) {
      const page = context.cdp.getSelectedPage()
      const target = page.target() as { targetId?: string; _targetId?: string }
      const targetId = target.targetId ?? target._targetId
      if (!targetId) {
        throw new Error('Failed to resolve selected page target ID.')
      }
      const entry = context.registry.getByTargetId(targetId)
      if (!entry) {
        throw new Error(
          'Selected page is not registered. Call list_pages first.',
        )
      }
      pageOrHandle = await context.state.getElementByUid(
        entry.pageId,
        request.params.uid,
      )
    } else {
      pageOrHandle = context.cdp.getSelectedPage()
    }

    const format = request.params.format
    const quality = format === 'png' ? undefined : request.params.quality

    const imageData = await pageOrHandle.screenshot({
      type: format,
      fullPage: request.params.fullPage,
      quality,
      optimizeForSpeed: true,
    })

    if (request.params.uid) {
      response.appendResponseLine(
        `Took a screenshot of node with uid "${request.params.uid}".`,
      )
    } else if (request.params.fullPage) {
      response.appendResponseLine('Took a screenshot of the full current page.')
    } else {
      response.appendResponseLine(
        "Took a screenshot of the current page's viewport.",
      )
    }

    if (request.params.filePath) {
      const file = await context.cdp.saveFile(
        imageData,
        request.params.filePath,
      )
      response.appendResponseLine(`Saved screenshot to ${file.filename}.`)
    } else if (imageData.length >= 2_000_000) {
      const { filename } = await context.cdp.saveTemporaryFile(
        imageData,
        `image/${request.params.format}`,
      )
      response.appendResponseLine(`Saved screenshot to ${filename}.`)
    } else {
      response.attachImage({
        mimeType: `image/${request.params.format}`,
        data: Buffer.from(imageData).toString('base64'),
      })
    }
  },
})
