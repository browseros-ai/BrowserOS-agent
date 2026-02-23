import { z } from 'zod'
import { defineTool } from './framework'

export const list_windows = defineTool({
  name: 'list_windows',
  description: 'List all browser windows',
  input: z.object({}),
  handler: async (_args, ctx, response) => {
    const windows = await ctx.browser.listWindows()

    if (windows.length === 0) {
      response.text('No windows found.')
      return
    }

    const lines: string[] = [`Found ${windows.length} windows:`, '']
    for (const w of windows) {
      const markers: string[] = []
      if (!w.isVisible) markers.push('HIDDEN')
      if (w.isActive) markers.push('ACTIVE')
      const suffix = markers.length > 0 ? ` [${markers.join(', ')}]` : ''
      lines.push(
        `Window ${w.windowId} (${w.windowType}, ${w.tabCount} tabs)${suffix}`,
      )
    }

    response.text(lines.join('\n'))
  },
})

export const create_window = defineTool({
  name: 'create_window',
  description: 'Create a new browser window',
  input: z.object({
    hidden: z.boolean().optional().describe('Create as hidden window'),
  }),
  handler: async (args, ctx, response) => {
    const window = await ctx.browser.createWindow(args)
    const hiddenMarker = !window.isVisible ? ' (hidden)' : ''
    response.text(`Created window ${window.windowId}${hiddenMarker}`)
  },
})

export const close_window = defineTool({
  name: 'close_window',
  description: 'Close a browser window',
  input: z.object({
    windowId: z.number().describe('Window ID to close'),
  }),
  handler: async (args, ctx, response) => {
    await ctx.browser.closeWindow(args.windowId)
    response.text(`Closed window ${args.windowId}`)
    response.includePages()
  },
})

export const activate_window = defineTool({
  name: 'activate_window',
  description: 'Activate (focus) a browser window',
  input: z.object({
    windowId: z.number().describe('Window ID to activate'),
  }),
  handler: async (args, ctx, response) => {
    await ctx.browser.activateWindow(args.windowId)
    response.text(`Activated window ${args.windowId}`)
  },
})
