/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { logger } from '../../../browser/cdp/logger'
import type { TextSnapshotNode } from '../../../browser/session-state'
import { ToolCategories } from '../../types/tool-categories'
import type { ElementHandle } from '../third-party'
import { zod } from '../third-party'
import type { CdpToolContext } from '../types/cdp-tool-context'
import { commonSchemas, defineTool } from '../types/cdp-tool-definition'
import { parseKey } from '../utils/keyboard'

const dblClickSchema = zod
  .boolean()
  .optional()
  .describe('Set to true for double clicks. Default is false.')

const includeSnapshotSchema = zod
  .boolean()
  .optional()
  .describe('Whether to include a snapshot in the response. Default is false.')

function getSelectedPageId(context: CdpToolContext): number {
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

async function getElementByUid(
  context: CdpToolContext,
  uid: string,
): Promise<ElementHandle<Element>> {
  return context.state.getElementByUid(getSelectedPageId(context), uid)
}

function getAXNodeByUid(
  context: CdpToolContext,
  uid: string,
): TextSnapshotNode | undefined {
  return context.state.getAXNodeByUid(getSelectedPageId(context), uid)
}

function handleActionError(error: unknown, uid: string) {
  logger('failed to act using a locator', error)
  throw new Error(
    `Failed to interact with the element with uid ${uid}. The element did not become interactive within the configured timeout.`,
    {
      cause: error,
    },
  )
}

export const click = defineTool({
  name: 'click',
  description: `Clicks on the provided element`,
  kind: 'cdp' as const,
  annotations: {
    category: ToolCategories.INPUT_AUTOMATION,
    readOnlyHint: false,
  },
  schema: {
    ...commonSchemas.cdpTarget,
    uid: zod
      .string()
      .describe(
        'The uid of an element on the page from the page content snapshot',
      ),
    dblClick: dblClickSchema,
    includeSnapshot: includeSnapshotSchema,
  },
  handler: async (request, response, context) => {
    const uid = request.params.uid
    const handle = await getElementByUid(context, uid)
    try {
      await context.cdp.waitForEventsAfterAction(async () => {
        await handle.asLocator().click({
          count: request.params.dblClick ? 2 : 1,
        })
      })
      response.appendResponseLine(
        request.params.dblClick
          ? `Successfully double clicked on the element`
          : `Successfully clicked on the element`,
      )
      if (request.params.includeSnapshot) {
        response.includeSnapshot()
      }
    } catch (error) {
      handleActionError(error, uid)
    } finally {
      void handle.dispose()
    }
  },
})

export const clickAt = defineTool({
  name: 'click_at',
  description: `Clicks at the provided coordinates`,
  kind: 'cdp' as const,
  annotations: {
    category: ToolCategories.INPUT_AUTOMATION,
    readOnlyHint: false,
    conditions: ['computerVision'],
  },
  schema: {
    ...commonSchemas.cdpTarget,
    x: zod.number().describe('The x coordinate'),
    y: zod.number().describe('The y coordinate'),
    dblClick: dblClickSchema,
    includeSnapshot: includeSnapshotSchema,
  },
  handler: async (request, response, context) => {
    const page = context.cdp.getSelectedPage()
    await context.cdp.waitForEventsAfterAction(async () => {
      await page.mouse.click(request.params.x, request.params.y, {
        clickCount: request.params.dblClick ? 2 : 1,
      })
    })
    response.appendResponseLine(
      request.params.dblClick
        ? `Successfully double clicked at the coordinates`
        : `Successfully clicked at the coordinates`,
    )
    if (request.params.includeSnapshot) {
      response.includeSnapshot()
    }
  },
})

export const hover = defineTool({
  name: 'hover',
  description: `Hover over the provided element`,
  kind: 'cdp' as const,
  annotations: {
    category: ToolCategories.INPUT_AUTOMATION,
    readOnlyHint: false,
  },
  schema: {
    ...commonSchemas.cdpTarget,
    uid: zod
      .string()
      .describe(
        'The uid of an element on the page from the page content snapshot',
      ),
    includeSnapshot: includeSnapshotSchema,
  },
  handler: async (request, response, context) => {
    const uid = request.params.uid
    const handle = await getElementByUid(context, uid)
    try {
      await context.cdp.waitForEventsAfterAction(async () => {
        await handle.asLocator().hover()
      })
      response.appendResponseLine(`Successfully hovered over the element`)
      if (request.params.includeSnapshot) {
        response.includeSnapshot()
      }
    } catch (error) {
      handleActionError(error, uid)
    } finally {
      void handle.dispose()
    }
  },
})

async function selectOption(
  handle: ElementHandle,
  aXNode: TextSnapshotNode,
  value: string,
) {
  let optionFound = false
  for (const child of aXNode.children) {
    if (child.role === 'option' && child.name === value && child.value) {
      optionFound = true
      const childHandle = await child.elementHandle()
      if (childHandle) {
        try {
          const childValueHandle = await childHandle.getProperty('value')
          try {
            const childValue = await childValueHandle.jsonValue()
            if (childValue) {
              await handle.asLocator().fill(childValue.toString())
            }
          } finally {
            void childValueHandle.dispose()
          }
          break
        } finally {
          void childHandle.dispose()
        }
      }
    }
  }
  if (!optionFound) {
    throw new Error(`Could not find option with text "${value}"`)
  }
}

async function fillFormElement(
  uid: string,
  value: string,
  context: CdpToolContext,
) {
  const handle = await getElementByUid(context, uid)
  try {
    const aXNode = getAXNodeByUid(context, uid)
    if (aXNode && aXNode.role === 'combobox') {
      await selectOption(handle, aXNode, value)
    } else {
      const timeoutPerChar = 10
      const fillTimeout =
        context.cdp.getSelectedPage().getDefaultTimeout() +
        value.length * timeoutPerChar
      await handle.asLocator().setTimeout(fillTimeout).fill(value)
    }
  } catch (error) {
    handleActionError(error, uid)
  } finally {
    void handle.dispose()
  }
}

export const fill = defineTool({
  name: 'fill',
  description: `Type text into a input, text area or select an option from a <select> element.`,
  kind: 'cdp' as const,
  annotations: {
    category: ToolCategories.INPUT_AUTOMATION,
    readOnlyHint: false,
  },
  schema: {
    ...commonSchemas.cdpTarget,
    uid: zod
      .string()
      .describe(
        'The uid of an element on the page from the page content snapshot',
      ),
    value: zod.string().describe('The value to fill in'),
    includeSnapshot: includeSnapshotSchema,
  },
  handler: async (request, response, context) => {
    await context.cdp.waitForEventsAfterAction(async () => {
      await context.cdp.getSelectedPage().keyboard.type(request.params.value)
      await fillFormElement(request.params.uid, request.params.value, context)
    })
    response.appendResponseLine(`Successfully filled out the element`)
    if (request.params.includeSnapshot) {
      response.includeSnapshot()
    }
  },
})

export const drag = defineTool({
  name: 'drag',
  description: `Drag an element onto another element`,
  kind: 'cdp' as const,
  annotations: {
    category: ToolCategories.INPUT_AUTOMATION,
    readOnlyHint: false,
  },
  schema: {
    ...commonSchemas.cdpTarget,
    from_uid: zod.string().describe('The uid of the element to drag'),
    to_uid: zod.string().describe('The uid of the element to drop into'),
    includeSnapshot: includeSnapshotSchema,
  },
  handler: async (request, response, context) => {
    const fromHandle = await getElementByUid(context, request.params.from_uid)
    const toHandle = await getElementByUid(context, request.params.to_uid)
    try {
      await context.cdp.waitForEventsAfterAction(async () => {
        await fromHandle.drag(toHandle)
        await new Promise((resolve) => setTimeout(resolve, 50))
        await toHandle.drop(fromHandle)
      })
      response.appendResponseLine(`Successfully dragged an element`)
      if (request.params.includeSnapshot) {
        response.includeSnapshot()
      }
    } finally {
      void fromHandle.dispose()
      void toHandle.dispose()
    }
  },
})

export const fillForm = defineTool({
  name: 'fill_form',
  description: `Fill out multiple form elements at once`,
  kind: 'cdp' as const,
  annotations: {
    category: ToolCategories.INPUT_AUTOMATION,
    readOnlyHint: false,
  },
  schema: {
    ...commonSchemas.cdpTarget,
    elements: zod
      .array(
        zod.object({
          uid: zod.string().describe('The uid of the element to fill out'),
          value: zod.string().describe('Value for the element'),
        }),
      )
      .describe('Elements from snapshot to fill out.'),
    includeSnapshot: includeSnapshotSchema,
  },
  handler: async (request, response, context) => {
    for (const element of request.params.elements) {
      await context.cdp.waitForEventsAfterAction(async () => {
        await fillFormElement(element.uid, element.value, context)
      })
    }
    response.appendResponseLine(`Successfully filled out the form`)
    if (request.params.includeSnapshot) {
      response.includeSnapshot()
    }
  },
})

export const uploadFile = defineTool({
  name: 'upload_file',
  description: 'Upload a file through a provided element.',
  kind: 'cdp' as const,
  annotations: {
    category: ToolCategories.INPUT_AUTOMATION,
    readOnlyHint: false,
  },
  schema: {
    ...commonSchemas.cdpTarget,
    uid: zod
      .string()
      .describe(
        'The uid of the file input element or an element that will open file chooser on the page from the page content snapshot',
      ),
    filePath: zod.string().describe('The local path of the file to upload'),
    includeSnapshot: includeSnapshotSchema,
  },
  handler: async (request, response, context) => {
    const { uid, filePath } = request.params
    const handle = (await getElementByUid(
      context,
      uid,
    )) as ElementHandle<HTMLInputElement>
    try {
      try {
        await handle.uploadFile(filePath)
      } catch {
        try {
          const page = context.cdp.getSelectedPage()
          const [fileChooser] = await Promise.all([
            page.waitForFileChooser({ timeout: 3000 }),
            handle.asLocator().click(),
          ])
          await fileChooser.accept([filePath])
        } catch {
          throw new Error(
            `Failed to upload file. The element could not accept the file directly, and clicking it did not trigger a file chooser.`,
          )
        }
      }
      if (request.params.includeSnapshot) {
        response.includeSnapshot()
      }
      response.appendResponseLine(`File uploaded from ${filePath}.`)
    } finally {
      void handle.dispose()
    }
  },
})

export const pressKey = defineTool({
  name: 'press_key',
  description: `Press a key or key combination. Use this when other input methods like fill() cannot be used (e.g., keyboard shortcuts, navigation keys, or special key combinations).`,
  kind: 'cdp' as const,
  annotations: {
    category: ToolCategories.INPUT_AUTOMATION,
    readOnlyHint: false,
  },
  schema: {
    ...commonSchemas.cdpTarget,
    key: zod
      .string()
      .describe(
        'The key or key combination to press. Examples: "Enter", "Tab", "Escape", "ArrowDown", "Control+A", "Meta+Shift+T".',
      ),
    includeSnapshot: includeSnapshotSchema,
  },
  handler: async (request, response, context) => {
    const page = context.cdp.getSelectedPage()
    const keyParts = parseKey(request.params.key)

    await context.cdp.waitForEventsAfterAction(async () => {
      if (keyParts.length > 1) {
        const modifiers = keyParts.slice(0, -1)
        const mainKey = keyParts[keyParts.length - 1]

        for (const modifier of modifiers) {
          await page.keyboard.down(modifier)
        }

        await page.keyboard.press(mainKey)

        for (const modifier of modifiers.reverse()) {
          await page.keyboard.up(modifier)
        }
      } else {
        await page.keyboard.press(keyParts[0])
      }
    })

    response.appendResponseLine(
      `Successfully pressed key: ${request.params.key}`,
    )

    if (request.params.includeSnapshot) {
      response.includeSnapshot()
    }
  },
})
