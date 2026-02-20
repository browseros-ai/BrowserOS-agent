import { z } from 'zod'
import { defineTool } from './core/framework'

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

export const list_tab_groups = defineTool({
  name: 'list_tab_groups',
  description: 'List all tab groups in the browser',
  input: z.object({}),
  handler: async (_args, ctx, response) => {
    const groups = await ctx.browser.listTabGroups()

    if (groups.length === 0) {
      response.text('No tab groups found.')
      return
    }

    const lines: string[] = [`Found ${groups.length} tab groups:`, '']

    for (const group of groups) {
      const collapsedMarker = group.collapsed ? ' [COLLAPSED]' : ''
      lines.push(
        `[${group.id}] "${group.title || '(unnamed)'}" (${group.color})${collapsedMarker}`,
      )
      lines.push(`    Tabs: ${group.tabIds.join(', ')}`)
      lines.push(`    Window: ${group.windowId}`)
    }

    response.text(lines.join('\n'))
  },
})

export const group_tabs = defineTool({
  name: 'group_tabs',
  description:
    'Group tabs together with an optional title and color. Use this to organize related tabs.',
  input: z.object({
    tabIds: z.array(z.number()).describe('Array of tab IDs to group together'),
    title: z.string().optional().describe('Title for the group'),
    color: z.enum(TAB_GROUP_COLORS).optional().describe('Color for the group'),
    groupId: z.number().optional().describe('Existing group ID to add tabs to'),
  }),
  handler: async (args, ctx, response) => {
    const group = await ctx.browser.groupTabs(args.tabIds, {
      title: args.title,
      color: args.color,
      groupId: args.groupId,
    })
    response.text(
      `Grouped ${args.tabIds.length} tabs into "${group.title || '(unnamed)'}" (${group.color})\nGroup ID: ${group.id}`,
    )
  },
})

export const update_tab_group = defineTool({
  name: 'update_tab_group',
  description: "Update a tab group's title, color, or collapsed state",
  input: z.object({
    groupId: z.number().describe('ID of the group to update'),
    title: z.string().optional().describe('New title for the group'),
    color: z
      .enum(TAB_GROUP_COLORS)
      .optional()
      .describe('New color for the group'),
    collapsed: z
      .boolean()
      .optional()
      .describe('Whether to collapse (hide) the group tabs'),
  }),
  handler: async (args, ctx, response) => {
    const group = await ctx.browser.updateTabGroup(args.groupId, {
      title: args.title,
      color: args.color,
      collapsed: args.collapsed,
    })
    response.text(
      `Updated group ${group.id}: "${group.title || '(unnamed)'}" (${group.color})${group.collapsed ? ' [COLLAPSED]' : ''}`,
    )
  },
})

export const ungroup_tabs = defineTool({
  name: 'ungroup_tabs',
  description: 'Remove tabs from their groups',
  input: z.object({
    tabIds: z
      .array(z.number())
      .describe('Array of tab IDs to remove from their groups'),
  }),
  handler: async (args, ctx, response) => {
    const result = await ctx.browser.ungroupTabs(args.tabIds)
    response.text(`Ungrouped ${result.ungroupedCount} tabs`)
  },
})
