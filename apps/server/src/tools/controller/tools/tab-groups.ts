/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { z } from 'zod'
import { ToolCategories } from '../../types/tool-categories'
import { defineTool } from '../../types/tool-definition'
import type { ControllerToolContext } from '../types/controller-tool-context'
import type { Response } from '../types/response'

const TAB_GROUP_COLORS = [
  'grey',
  'blue',
  'red',
  'yellow',
  'green',
  'pink',
  'purple',
  'cyan',
  'orange',
] as const

function resolvePageIdsFromTabIds(
  context: ControllerToolContext,
  tabIds: number[],
): number[] {
  return tabIds
    .map((tabId) => context.registry.getByTabId(tabId)?.pageId)
    .filter((value): value is number => value !== undefined)
}

export const listTabGroups = defineTool<
  z.ZodRawShape,
  ControllerToolContext,
  Response
>({
  name: 'list_tab_groups',
  description: 'List all tab groups in the browser',
  kind: 'controller' as const,
  annotations: {
    category: ToolCategories.TAB_MANAGEMENT,
    readOnlyHint: true,
  },
  schema: {},
  handler: async (_request, response, context) => {
    const result = await context.controller.executeAction('listTabGroups', {})
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

    const groups = data.groups.map((group) => ({
      ...group,
      pageIds: resolvePageIdsFromTabIds(context, group.tabIds),
    }))

    if (groups.length === 0) {
      response.appendResponseLine('No tab groups found.')
    } else {
      response.appendResponseLine(`Found ${groups.length} tab groups:`)
      response.appendResponseLine('')

      for (const group of groups) {
        const collapsedMarker = group.collapsed ? ' [COLLAPSED]' : ''
        response.appendResponseLine(
          `[${group.id}] "${group.title || '(unnamed)'}" (${group.color})${collapsedMarker}`,
        )
        response.appendResponseLine(
          `    Page IDs: ${group.pageIds.join(', ') || '(none tracked)'}`,
        )
        response.appendResponseLine(
          `    Tab IDs: ${group.tabIds.join(', ') || '(none)'}`,
        )
        response.appendResponseLine(`    Window: ${group.windowId}`)
      }
    }

    response.addStructuredContent('groups', groups)
    response.addStructuredContent('count', groups.length)
  },
})

export const groupTabs = defineTool<
  z.ZodRawShape,
  ControllerToolContext,
  Response
>({
  name: 'group_tabs',
  description:
    'Group pages together with an optional title and color. Use this to organize related pages.',
  kind: 'controller' as const,
  annotations: {
    category: ToolCategories.TAB_MANAGEMENT,
    readOnlyHint: false,
  },
  schema: {
    pageIds: z
      .array(z.coerce.number())
      .min(1)
      .describe('Array of page IDs to group together'),
    title: z
      .string()
      .optional()
      .describe('Title for the group (e.g., "Shopping", "Work", "Research")'),
    color: z.enum(TAB_GROUP_COLORS).optional().describe('Color for the group'),
    groupId: z.coerce
      .number()
      .optional()
      .describe('Existing group ID to add pages to'),
  },
  handler: async (request, response, context) => {
    const { pageIds, title, color, groupId } = request.params as {
      pageIds: number[]
      title?: string
      color?: string
      groupId?: number
    }

    const tabIds = pageIds.map((pageId) => context.registry.getTabId(pageId))

    const result = await context.controller.executeAction('groupTabs', {
      tabIds,
      title,
      color,
      groupId,
    })
    const data = result as {
      groupId: number
      title: string
      color: string
      tabCount: number
    }

    response.appendResponseLine(
      `Grouped ${tabIds.length} pages into "${data.title || '(unnamed)'}" (${data.color})`,
    )
    response.appendResponseLine(`Group ID: ${data.groupId}`)
    response.appendResponseLine(`Page IDs: ${pageIds.join(', ')}`)

    response.addStructuredContent('groupId', data.groupId)
    response.addStructuredContent('title', data.title)
    response.addStructuredContent('color', data.color)
    response.addStructuredContent('tabCount', data.tabCount)
    response.addStructuredContent('pageIds', pageIds)
    response.addStructuredContent('tabIds', tabIds)
  },
})

export const updateTabGroup = defineTool<
  z.ZodRawShape,
  ControllerToolContext,
  Response
>({
  name: 'update_tab_group',
  description: "Update a tab group's title, color, or collapsed state",
  kind: 'controller' as const,
  annotations: {
    category: ToolCategories.TAB_MANAGEMENT,
    readOnlyHint: false,
  },
  schema: {
    groupId: z.coerce.number().describe('ID of the group to update'),
    title: z.string().optional().describe('New title for the group'),
    color: z
      .enum(TAB_GROUP_COLORS)
      .optional()
      .describe('New color for the group'),
    collapsed: z
      .boolean()
      .optional()
      .describe('Whether to collapse (hide) the group tabs'),
  },
  handler: async (request, response, context) => {
    const { groupId, title, color, collapsed } = request.params as {
      groupId: number
      title?: string
      color?: string
      collapsed?: boolean
    }

    const result = await context.controller.executeAction('updateTabGroup', {
      groupId,
      title,
      color,
      collapsed,
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

export const ungroupTabs = defineTool<
  z.ZodRawShape,
  ControllerToolContext,
  Response
>({
  name: 'ungroup_tabs',
  description: 'Remove pages from their groups',
  kind: 'controller' as const,
  annotations: {
    category: ToolCategories.TAB_MANAGEMENT,
    readOnlyHint: false,
  },
  schema: {
    pageIds: z
      .array(z.coerce.number())
      .min(1)
      .describe('Array of page IDs to remove from their groups'),
  },
  handler: async (request, response, context) => {
    const { pageIds } = request.params as { pageIds: number[] }
    const tabIds = pageIds.map((pageId) => context.registry.getTabId(pageId))

    const result = await context.controller.executeAction('ungroupTabs', {
      tabIds,
    })
    const data = result as { ungroupedCount: number }

    response.appendResponseLine(`Ungrouped ${data.ungroupedCount} pages`)
    response.addStructuredContent('ungroupedCount', data.ungroupedCount)
    response.addStructuredContent('pageIds', pageIds)
    response.addStructuredContent('tabIds', tabIds)
  },
})
