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
  description: `Evaluate a JavaScript function inside a page. Returns the response as JSON
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
      const frames = new Set<Frame>()
      for (const el of request.params.args ?? []) {
        const handle = await context.getElementByUid(el.uid)
        frames.add(handle.frame)
        args.push(handle)
      }
      let pageOrFrame: Page | Frame
      // We can't evaluate the element handle across frames
      if (frames.size > 1) {
        throw new Error(
          "Elements from different frames can't be evaluated together.",
        )
      } else {
        pageOrFrame = [...frames.values()][0] ?? context.getSelectedPage()
      }
      const fn = await pageOrFrame.evaluateHandle(
        `(${request.params.function})`,
      )
      args.unshift(fn)
      await context.waitForEventsAfterAction(async () => {
        const result = await pageOrFrame.evaluate(
          async (fn, ...args) => {
            // @ts-expect-error no types.
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
