import { z } from 'zod'
import { defineTool } from './core/framework'

const pageParam = z.number().describe('Page ID (from list_pages)')
const elementParam = z
  .number()
  .describe('Element ID from snapshot (the number in [N])')

export const click = defineTool({
  name: 'click',
  description: 'Click an element by its ID from the last snapshot',
  input: z.object({
    page: pageParam,
    element: elementParam,
    button: z
      .enum(['left', 'right', 'middle'])
      .default('left')
      .describe('Mouse button'),
    clickCount: z
      .number()
      .default(1)
      .describe('Number of clicks (2 for double-click)'),
  }),
  handler: async (args, ctx, response) => {
    await ctx.browser.click(args.page, args.element, {
      button: args.button,
      clickCount: args.clickCount,
    })
    response.text(`Clicked [${args.element}]`)
    response.includeSnapshot(0)
  },
})

export const click_at = defineTool({
  name: 'click_at',
  description: 'Click at specific page coordinates',
  input: z.object({
    page: pageParam,
    x: z.number().describe('X coordinate'),
    y: z.number().describe('Y coordinate'),
    button: z
      .enum(['left', 'right', 'middle'])
      .default('left')
      .describe('Mouse button'),
    clickCount: z.number().default(1).describe('Number of clicks'),
  }),
  handler: async (args, ctx, response) => {
    await ctx.browser.clickAt(args.page, args.x, args.y, {
      button: args.button,
      clickCount: args.clickCount,
    })
    response.text(`Clicked at (${args.x}, ${args.y})`)
    response.includeSnapshot(0)
  },
})

export const hover = defineTool({
  name: 'hover',
  description: 'Hover over an element by its ID',
  input: z.object({
    page: pageParam,
    element: elementParam,
  }),
  handler: async (args, ctx, response) => {
    await ctx.browser.hover(args.page, args.element)
    response.text(`Hovered over [${args.element}]`)
  },
})

export const clear = defineTool({
  name: 'clear',
  description: 'Clear the text content of an input or textarea element',
  input: z.object({
    page: pageParam,
    element: elementParam,
  }),
  handler: async (args, ctx, response) => {
    await ctx.browser.fill(args.page, args.element, '', true)
    response.text(`Cleared [${args.element}]`)
    response.includeSnapshot(0)
  },
})

export const fill = defineTool({
  name: 'fill',
  description:
    'Type text into an input or textarea element. Focuses the element, optionally clears existing text, then types character by character.',
  input: z.object({
    page: pageParam,
    element: elementParam,
    text: z.string().describe('Text to type'),
    clear: z
      .boolean()
      .default(true)
      .describe('Clear existing text before typing'),
  }),
  handler: async (args, ctx, response) => {
    await ctx.browser.fill(args.page, args.element, args.text, args.clear)
    response.text(`Typed ${args.text.length} characters into [${args.element}]`)
    response.includeSnapshot(0)
  },
})

export const press_key = defineTool({
  name: 'press_key',
  description:
    "Press a key or key combination (e.g. 'Enter', 'Escape', 'Control+A', 'Meta+Shift+P'). Sent to the currently focused element.",
  input: z.object({
    page: pageParam,
    key: z
      .string()
      .describe("Key or combo like 'Enter', 'Control+A', 'ArrowDown'"),
  }),
  handler: async (args, ctx, response) => {
    await ctx.browser.pressKey(args.page, args.key)
    response.text(`Pressed ${args.key}`)
  },
})

export const drag = defineTool({
  name: 'drag',
  description:
    'Drag from one element to another element or to specific coordinates',
  input: z.object({
    page: pageParam,
    sourceElement: elementParam.describe('Element ID to drag from'),
    targetElement: z.number().optional().describe('Element ID to drag to'),
    targetX: z
      .number()
      .optional()
      .describe('Target X coordinate (if not using targetElement)'),
    targetY: z
      .number()
      .optional()
      .describe('Target Y coordinate (if not using targetElement)'),
  }),
  handler: async (args, ctx, response) => {
    await ctx.browser.drag(args.page, args.sourceElement, {
      element: args.targetElement,
      x: args.targetX,
      y: args.targetY,
    })
    const target =
      args.targetElement !== undefined
        ? `[${args.targetElement}]`
        : `(${args.targetX}, ${args.targetY})`
    response.text(`Dragged [${args.sourceElement}] \u2192 ${target}`)
    response.includeSnapshot(0)
  },
})

export const scroll = defineTool({
  name: 'scroll',
  description: 'Scroll the page or a specific element',
  input: z.object({
    page: pageParam,
    direction: z
      .enum(['up', 'down', 'left', 'right'])
      .default('down')
      .describe('Scroll direction'),
    amount: z.number().default(3).describe('Number of scroll ticks'),
    element: z
      .number()
      .optional()
      .describe('Element ID to scroll at (scrolls page center if omitted)'),
  }),
  handler: async (args, ctx, response) => {
    await ctx.browser.scroll(
      args.page,
      args.direction,
      args.amount,
      args.element,
    )
    response.text(`Scrolled ${args.direction} by ${args.amount}`)
    response.includeSnapshot(0)
  },
})

export const handle_dialog = defineTool({
  name: 'handle_dialog',
  description: 'Accept or dismiss a JavaScript dialog (alert, confirm, prompt)',
  input: z.object({
    page: pageParam,
    accept: z.boolean().describe('true to accept, false to dismiss'),
    promptText: z
      .string()
      .optional()
      .describe('Text to enter for prompt dialogs'),
  }),
  handler: async (args, ctx, response) => {
    await ctx.browser.handleDialog(args.page, args.accept, args.promptText)
    response.text(args.accept ? 'Dialog accepted' : 'Dialog dismissed')
  },
})

export const select_option = defineTool({
  name: 'select_option',
  description:
    'Select an option in a <select> dropdown by value or visible text',
  input: z.object({
    page: pageParam,
    element: elementParam.describe('Element ID of the <select> element'),
    value: z.string().describe('Option value or visible text to select'),
  }),
  handler: async (args, ctx, response) => {
    const selected = await ctx.browser.selectOption(
      args.page,
      args.element,
      args.value,
    )
    if (selected === null) {
      response.error(
        `Option "${args.value}" not found in select [${args.element}]. Use take_snapshot to see available options.`,
      )
      return
    }
    response.text(`Selected "${selected}" in [${args.element}]`)
    response.includeSnapshot(0)
  },
})
