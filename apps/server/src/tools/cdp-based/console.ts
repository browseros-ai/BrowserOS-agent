/**
 * @license
 * Copyright 2025 BrowserOS
 */
import { ToolCategories } from '../types/tool-categories'
import { defineTool } from '../types/tool-definition'

export const consoleTool = defineTool({
  name: 'list_console_messages',
  description: 'List all console messages for the currently selected page',
  annotations: {
    category: ToolCategories.DEBUGGING,
    readOnlyHint: true,
  },
  schema: {},
  handler: async (_request, response) => {
    response.setIncludeConsoleData(true)
  },
})
