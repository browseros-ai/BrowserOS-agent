/**
 * @license
 * Copyright 2025 BrowserOS
 */
import { z } from 'zod'

import { ToolCategories } from '../../types/tool-categories'
import { defineTool } from '../../types/tool-definition'
import type { Context } from '../types/context'
import type { Response } from '../types/response'

export const getActiveTab = defineTool<z.ZodRawShape, Context, Response>({
  name: 'browser_get_active_tab',
  description: 'Get information about the currently active browser tab',
  annotations: {
    category: ToolCategories.TAB_MANAGEMENT,
    readOnlyHint: true,
  },
  schema: {
    windowId: z.number().optional().describe('Window ID (injected by agent)'),
  },
  handler: async (request, response, context) => {
    const params = request.params as { windowId?: number }
    const result = await context.executeAction('getActiveTab', params)
    const data = result as {
      tabId: number
      url: string
      title: string
      windowId: number
    }

    response.appendResponseLine(`Active Tab: ${data.title}`)
    response.appendResponseLine(`URL: ${data.url}`)
    response.appendResponseLine(`Tab ID: ${data.tabId}`)
    response.appendResponseLine(`Window ID: ${data.windowId}`)

    response.addStructuredContent('tabId', data.tabId)
    response.addStructuredContent('url', data.url)
    response.addStructuredContent('title', data.title)
    response.addStructuredContent('windowId', data.windowId)
  },
})

export const listTabs = defineTool<z.ZodRawShape, Context, Response>({
  name: 'browser_list_tabs',
  description: 'Get a list of all open browser tabs',
  annotations: {
    category: ToolCategories.TAB_MANAGEMENT,
    readOnlyHint: true,
  },
  schema: {
    windowId: z.number().optional().describe('Window ID (injected by agent)'),
  },
  handler: async (request, response, context) => {
    const params = request.params as { windowId?: number }
    const result = await context.executeAction('getTabs', params)
    const data = result as {
      tabs: Array<{
        id: number
        url: string
        title: string
        windowId: number
        active: boolean
        index: number
      }>
      count: number
    }

    response.appendResponseLine(`Found ${data.count} open tabs:`)
    response.appendResponseLine('')

    for (const tab of data.tabs) {
      const activeMarker = tab.active ? ' [ACTIVE]' : ''
      response.appendResponseLine(`[${tab.id}]${activeMarker} ${tab.title}`)
      response.appendResponseLine(`    ${tab.url}`)
      response.appendResponseLine(
        `    Window: ${tab.windowId} | Position: ${tab.index}`,
      )
    }

    response.addStructuredContent('tabs', data.tabs)
    response.addStructuredContent('count', data.count)
  },
})

export const openTab = defineTool<z.ZodRawShape, Context, Response>({
  name: 'browser_open_tab',
  description: 'Open a new browser tab with optional URL',
  annotations: {
    category: ToolCategories.TAB_MANAGEMENT,
    readOnlyHint: false,
  },
  schema: {
    url: z
      .string()
      .optional()
      .describe('URL to open (optional, defaults to new tab page)'),
    active: z
      .boolean()
      .optional()
      .describe('Whether to make the new tab active (default: true)'),
    windowId: z.number().optional().describe('Window ID (injected by agent)'),
  },
  handler: async (request, response, context) => {
    const params = request.params as {
      url?: string
      active?: boolean
      windowId?: number
    }

    const result = await context.executeAction('openTab', params)
    const data = result as { tabId: number; url: string; title?: string }

    response.appendResponseLine(`Opened new tab: ${data.title || 'Untitled'}`)
    response.appendResponseLine(`URL: ${data.url}`)
    response.appendResponseLine(`Tab ID: ${data.tabId}`)
  },
})

export const closeTab = defineTool<z.ZodRawShape, Context, Response>({
  name: 'browser_close_tab',
  description: 'Close a specific browser tab by ID',
  annotations: {
    category: ToolCategories.TAB_MANAGEMENT,
    readOnlyHint: false,
  },
  schema: {
    tabId: z.coerce.number().describe('ID of the tab to close'),
    windowId: z.number().optional().describe('Window ID for routing'),
  },
  handler: async (request, response, context) => {
    const { tabId, windowId } = request.params as {
      tabId: number
      windowId?: number
    }

    await context.executeAction('closeTab', { tabId, windowId })

    response.appendResponseLine(`Closed tab ${tabId}`)
  },
})

export const switchTab = defineTool<z.ZodRawShape, Context, Response>({
  name: 'browser_switch_tab',
  description: 'Switch to (activate) a specific tab',
  annotations: {
    category: ToolCategories.TAB_MANAGEMENT,
    readOnlyHint: false,
  },
  schema: {
    tabId: z.coerce.number().describe('ID of the tab to switch to'),
    windowId: z.number().optional().describe('Window ID for routing'),
  },
  handler: async (request, response, context) => {
    const { tabId, windowId } = request.params as {
      tabId: number
      windowId?: number
    }

    const result = await context.executeAction('switchTab', { tabId, windowId })
    const data = result as { tabId: number; url: string; title: string }

    response.appendResponseLine(`Switched to tab: ${data.title}`)
    response.appendResponseLine(`URL: ${data.url}`)
  },
})

export const getLoadStatus = defineTool<z.ZodRawShape, Context, Response>({
  name: 'browser_get_load_status',
  description: 'Check if a page has finished loading',
  annotations: {
    category: ToolCategories.TAB_MANAGEMENT,
    readOnlyHint: true,
  },
  schema: {
    tabId: z.coerce.number().describe('Tab ID to check'),
    windowId: z.number().optional().describe('Window ID for routing'),
  },
  handler: async (request, response, context) => {
    const { tabId, windowId } = request.params as {
      tabId: number
      windowId?: number
    }

    const result = await context.executeAction('getPageLoadStatus', {
      tabId,
      windowId,
    })
    const data = result as {
      tabId: number
      isResourcesLoading: boolean
      isDOMContentLoaded: boolean
      isPageComplete: boolean
    }

    response.appendResponseLine(`Tab ${tabId} load status:`)
    response.appendResponseLine(
      `Resources Loading: ${data.isResourcesLoading ? 'Yes' : 'No'}`,
    )
    response.appendResponseLine(
      `DOM Content Loaded: ${data.isDOMContentLoaded ? 'Yes' : 'No'}`,
    )
    response.appendResponseLine(
      `Page Complete: ${data.isPageComplete ? 'Yes' : 'No'}`,
    )
  },
})

export const listTabGroups = defineTool<z.ZodRawShape, Context, Response>({
  name: 'browser_list_tab_groups',
  description: 'List all tab groups in the browser',
  annotations: {
    category: ToolCategories.TAB_MANAGEMENT,
    readOnlyHint: true,
  },
  schema: {
    windowId: z.number().optional().describe('Window ID (injected by agent)'),
  },
  handler: async (request, response, context) => {
    const params = request.params as { windowId?: number }
    const result = await context.executeAction('listTabGroups', params)
    const data = result as {
      groups: Array<{
        id: number
        windowId: number
        title: string
        color: string
        collapsed: boolean
        tabIds: number[]
      }>
      count: number
    }

    if (data.count === 0) {
      response.appendResponseLine('No tab groups found.')
    } else {
      response.appendResponseLine(`Found ${data.count} tab groups:`)
      response.appendResponseLine('')

      for (const group of data.groups) {
        const collapsedMarker = group.collapsed ? ' [COLLAPSED]' : ''
        response.appendResponseLine(
          `[${group.id}] "${group.title || '(unnamed)'}" (${group.color})${collapsedMarker}`,
        )
        response.appendResponseLine(`    Tabs: ${group.tabIds.join(', ')}`)
        response.appendResponseLine(`    Window: ${group.windowId}`)
      }
    }

    response.addStructuredContent('groups', data.groups)
    response.addStructuredContent('count', data.count)
  },
})

export const groupTabs = defineTool<z.ZodRawShape, Context, Response>({
  name: 'browser_group_tabs',
  description:
    'Group tabs together with an optional title and color. Use this to organize related tabs.',
  annotations: {
    category: ToolCategories.TAB_MANAGEMENT,
    readOnlyHint: false,
  },
  schema: {
    tabIds: z
      .array(z.coerce.number())
      .describe('Array of tab IDs to group together'),
    title: z
      .string()
      .optional()
      .describe('Title for the group (e.g., "Shopping", "Work", "Research")'),
    color: z
      .enum([
        'grey',
        'blue',
        'red',
        'yellow',
        'green',
        'pink',
        'purple',
        'cyan',
        'orange',
      ])
      .optional()
      .describe('Color for the group'),
    groupId: z.coerce
      .number()
      .optional()
      .describe('Existing group ID to add tabs to'),
    windowId: z.number().optional().describe('Window ID for routing'),
  },
  handler: async (request, response, context) => {
    const { tabIds, title, color, groupId, windowId } = request.params as {
      tabIds: number[]
      title?: string
      color?: string
      groupId?: number
      windowId?: number
    }

    const result = await context.executeAction('groupTabs', {
      tabIds,
      title,
      color,
      groupId,
      windowId,
    })
    const data = result as {
      groupId: number
      title: string
      color: string
      tabCount: number
    }

    response.appendResponseLine(
      `Grouped ${data.tabCount} tabs into "${data.title || '(unnamed)'}" (${data.color})`,
    )
    response.appendResponseLine(`Group ID: ${data.groupId}`)

    response.addStructuredContent('groupId', data.groupId)
    response.addStructuredContent('title', data.title)
    response.addStructuredContent('color', data.color)
    response.addStructuredContent('tabCount', data.tabCount)
  },
})

export const updateTabGroup = defineTool<z.ZodRawShape, Context, Response>({
  name: 'browser_update_tab_group',
  description: "Update a tab group's title, color, or collapsed state",
  annotations: {
    category: ToolCategories.TAB_MANAGEMENT,
    readOnlyHint: false,
  },
  schema: {
    groupId: z.coerce.number().describe('ID of the group to update'),
    title: z.string().optional().describe('New title for the group'),
    color: z
      .enum([
        'grey',
        'blue',
        'red',
        'yellow',
        'green',
        'pink',
        'purple',
        'cyan',
        'orange',
      ])
      .optional()
      .describe('New color for the group'),
    collapsed: z
      .boolean()
      .optional()
      .describe('Whether to collapse (hide) the group tabs'),
    windowId: z.number().optional().describe('Window ID for routing'),
  },
  handler: async (request, response, context) => {
    const { groupId, title, color, collapsed, windowId } = request.params as {
      groupId: number
      title?: string
      color?: string
      collapsed?: boolean
      windowId?: number
    }

    const result = await context.executeAction('updateTabGroup', {
      groupId,
      title,
      color,
      collapsed,
      windowId,
    })
    const data = result as {
      groupId: number
      title: string
      color: string
      collapsed: boolean
    }

    response.appendResponseLine(
      `Updated group ${data.groupId}: "${data.title || '(unnamed)'}" (${data.color})${data.collapsed ? ' [COLLAPSED]' : ''}`,
    )

    response.addStructuredContent('groupId', data.groupId)
    response.addStructuredContent('title', data.title)
    response.addStructuredContent('color', data.color)
    response.addStructuredContent('collapsed', data.collapsed)
  },
})

export const ungroupTabs = defineTool<z.ZodRawShape, Context, Response>({
  name: 'browser_ungroup_tabs',
  description: 'Remove tabs from their groups',
  annotations: {
    category: ToolCategories.TAB_MANAGEMENT,
    readOnlyHint: false,
  },
  schema: {
    tabIds: z
      .array(z.coerce.number())
      .describe('Array of tab IDs to remove from their groups'),
    windowId: z.number().optional().describe('Window ID for routing'),
  },
  handler: async (request, response, context) => {
    const { tabIds, windowId } = request.params as {
      tabIds: number[]
      windowId?: number
    }

    const result = await context.executeAction('ungroupTabs', {
      tabIds,
      windowId,
    })
    const data = result as { ungroupedCount: number }

    response.appendResponseLine(`Ungrouped ${data.ungroupedCount} tabs`)

    response.addStructuredContent('ungroupedCount', data.ungroupedCount)
  },
})
