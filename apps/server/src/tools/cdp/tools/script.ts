/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { ToolCategories } from '../../types/tool-categories'
import type { Frame, JSHandle, Page } from '../third-party'
import { zod } from '../third-party'
import { commonSchemas, defineTool } from '../types/cdp-tool-definition'

export const evaluateScript = defineTool({
  name: 'evaluate_script',
  description: `Evaluate a JavaScript function inside the currently selected page. Returns the response as JSON
so returned values have to JSON-serializable.`,
  kind: 'cdp' as const,
  annotations: {
    category: ToolCategories.DEBUGGING,
    readOnlyHint: false,
  },
  schema: {
    ...commonSchemas.cdpTarget,
    function: zod.string().describe(
      `A JavaScript function declaration to be executed by the tool in the currently selected page.
Example without arguments: \`() => {
  return document.title
}\` or \`async () => {
  return await fetch("example.com")
}\`.
Example with arguments: \`(el) => {
  return el.innerText;
}\`
`,
    ),
    args: zod
      .array(
        zod.object({
          uid: zod
            .string()
            .describe(
              'The uid of an element on the page from the page content snapshot',
            ),
        }),
      )
      .optional()
      .describe(`An optional list of arguments to pass to the function.`),
  },
  handler: async (request, response, context) => {
    const args: Array<JSHandle<unknown>> = []
    try {
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

      const frames = new Set<Frame>()
      for (const el of request.params.args ?? []) {
        const handle = await context.state.getElementByUid(entry.pageId, el.uid)
        frames.add(handle.frame)
        args.push(handle)
      }

      let pageOrFrame: Page | Frame
      if (frames.size > 1) {
        throw new Error(
          "Elements from different frames can't be evaluated together.",
        )
      } else {
        pageOrFrame = [...frames.values()][0] ?? context.cdp.getSelectedPage()
      }

      const fn = await pageOrFrame.evaluateHandle(
        `(${request.params.function})`,
      )
      args.unshift(fn)

      await context.cdp.waitForEventsAfterAction(async () => {
        const result = await pageOrFrame.evaluate(
          async (fn, ...args) => {
            // @ts-expect-error Dynamic user function in browser context.
            return JSON.stringify(await fn(...args))
          },
          ...args,
        )
        response.appendResponseLine('Script ran on page and returned:')
        response.appendResponseLine('```json')
        response.appendResponseLine(`${result}`)
        response.appendResponseLine('```')
      })
    } finally {
      void Promise.allSettled(args.map((arg) => arg.dispose()))
    }
  },
})
