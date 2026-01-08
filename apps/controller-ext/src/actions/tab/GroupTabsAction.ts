/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import { z } from 'zod'
import { TabAdapter } from '@/adapters/TabAdapter'
import { ActionHandler } from '../ActionHandler'

const TabGroupColorSchema = z.enum([
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

const GroupTabsInputSchema = z
  .object({
    tabIds: z
      .array(z.number().int().positive())
      .min(1)
      .describe('Array of tab IDs to group together'),
    title: z
      .string()
      .optional()
      .describe('Title for the group (e.g., "Shopping", "Work", "Research")'),
    color: TabGroupColorSchema.optional().describe(
      'Color for the group: grey, blue, red, yellow, green, pink, purple, cyan, orange',
    ),
    groupId: z
      .number()
      .int()
      .optional()
      .describe(
        'Existing group ID to add tabs to. If not specified, creates a new group.',
      ),
    windowId: z
      .number()
      .int()
      .optional()
      .describe('Window ID for scoping the group lookup'),
  })
  .describe('Group tabs together with optional title and color')

type GroupTabsInput = z.infer<typeof GroupTabsInputSchema>

export interface GroupTabsOutput {
  groupId: number
  title: string
  color: string
  tabCount: number
}

/**
 * GroupTabsAction - Group tabs together
 *
 * Groups the specified tabs together into a new or existing group.
 * Optionally sets a title and color for the group.
 *
 * Example payloads:
 *
 * Create new group with tabs:
 * { "tabIds": [123, 456, 789], "title": "Shopping", "color": "green" }
 *
 * Add tabs to existing group:
 * { "tabIds": [123, 456], "groupId": 1 }
 *
 * Create unnamed group:
 * { "tabIds": [123, 456] }
 */
export class GroupTabsAction extends ActionHandler<
  GroupTabsInput,
  GroupTabsOutput
> {
  readonly inputSchema = GroupTabsInputSchema
  private tabAdapter = new TabAdapter()

  async execute(input: GroupTabsInput): Promise<GroupTabsOutput> {
    // Group the tabs (pass windowId to prevent tabs moving to wrong window)
    const groupId = await this.tabAdapter.groupTabs(
      input.tabIds,
      input.groupId,
      input.windowId,
    )

    // Update group properties if title or color provided
    if (input.title !== undefined || input.color !== undefined) {
      const updateProps: chrome.tabGroups.UpdateProperties = {}
      if (input.title !== undefined) updateProps.title = input.title
      if (input.color !== undefined) updateProps.color = input.color

      const updatedGroup = await this.tabAdapter.updateTabGroup(
        groupId,
        updateProps,
      )

      return {
        groupId,
        title: updatedGroup.title || '',
        color: updatedGroup.color,
        tabCount: input.tabIds.length,
      }
    }

    // Get group info if no updates were made
    // Determine which window to query - use windowId if provided, otherwise query all windows
    const groups = await this.tabAdapter.getTabGroups(input.windowId)
    const group = groups.find((g) => g.id === groupId)

    if (!group) {
      throw new Error(`Tab group ${groupId} not found`)
    }

    return {
      groupId,
      title: group.title || '',
      color: group.color,
      tabCount: input.tabIds.length,
    }
  }
}
