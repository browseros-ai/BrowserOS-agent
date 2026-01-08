/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import { z } from 'zod'
import { TabAdapter } from '@/adapters/TabAdapter'
import { ActionHandler } from '../ActionHandler'

const ListTabGroupsInputSchema = z
  .object({
    windowId: z
      .number()
      .int()
      .optional()
      .describe(
        'Window ID to get groups from. If not specified, gets all groups.',
      ),
  })
  .describe('Optional filters for querying tab groups')

type ListTabGroupsInput = z.infer<typeof ListTabGroupsInputSchema>

interface TabGroupInfo {
  id: number
  windowId: number
  title: string
  color: string
  collapsed: boolean
  tabIds: number[]
}

export interface ListTabGroupsOutput {
  groups: TabGroupInfo[]
  count: number
}

/**
 * ListTabGroupsAction - List all tab groups
 *
 * Returns a list of all tab groups with their IDs, titles, colors, and member tabs.
 *
 * Example payloads:
 *
 * Get all groups across all windows:
 * {}
 *
 * Get groups in specific window:
 * { "windowId": 12345 }
 */
export class ListTabGroupsAction extends ActionHandler<
  ListTabGroupsInput,
  ListTabGroupsOutput
> {
  readonly inputSchema = ListTabGroupsInputSchema
  private tabAdapter = new TabAdapter()

  async execute(input: ListTabGroupsInput): Promise<ListTabGroupsOutput> {
    const groups = await this.tabAdapter.getTabGroups(input.windowId)

    // Get all tabs to find which tabs belong to each group
    const tabs = input.windowId
      ? await this.tabAdapter.getTabsInWindow(input.windowId)
      : await this.tabAdapter.getAllTabs()

    // Build group info with tab IDs
    const groupInfos: TabGroupInfo[] = groups.map((group) => ({
      id: group.id,
      windowId: group.windowId,
      title: group.title || '',
      color: group.color,
      collapsed: group.collapsed,
      tabIds: tabs
        .filter((tab) => tab.groupId === group.id && tab.id !== undefined)
        .map((tab) => tab.id as number),
    }))

    return {
      groups: groupInfos,
      count: groupInfos.length,
    }
  }
}
