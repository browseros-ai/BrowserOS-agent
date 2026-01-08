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

const UpdateTabGroupInputSchema = z
  .object({
    groupId: z.number().int().describe('ID of the group to update'),
    title: z.string().optional().describe('New title for the group'),
    color: TabGroupColorSchema.optional().describe(
      'New color for the group: grey, blue, red, yellow, green, pink, purple, cyan, orange',
    ),
    collapsed: z
      .boolean()
      .optional()
      .describe('Whether to collapse (hide) the group tabs'),
  })
  .describe('Update tab group properties')

type UpdateTabGroupInput = z.infer<typeof UpdateTabGroupInputSchema>

export interface UpdateTabGroupOutput {
  groupId: number
  title: string
  color: string
  collapsed: boolean
}

/**
 * UpdateTabGroupAction - Update a tab group's properties
 *
 * Updates the title, color, or collapsed state of an existing tab group.
 *
 * Example payloads:
 *
 * Rename a group:
 * { "groupId": 1, "title": "Work Projects" }
 *
 * Change color:
 * { "groupId": 1, "color": "blue" }
 *
 * Collapse a group:
 * { "groupId": 1, "collapsed": true }
 *
 * Update multiple properties:
 * { "groupId": 1, "title": "Research", "color": "purple", "collapsed": false }
 */
export class UpdateTabGroupAction extends ActionHandler<
  UpdateTabGroupInput,
  UpdateTabGroupOutput
> {
  readonly inputSchema = UpdateTabGroupInputSchema
  private tabAdapter = new TabAdapter()

  async execute(input: UpdateTabGroupInput): Promise<UpdateTabGroupOutput> {
    const updateProps: chrome.tabGroups.UpdateProperties = {}

    if (input.title !== undefined) updateProps.title = input.title
    if (input.color !== undefined) updateProps.color = input.color
    if (input.collapsed !== undefined) updateProps.collapsed = input.collapsed

    const group = await this.tabAdapter.updateTabGroup(
      input.groupId,
      updateProps,
    )

    return {
      groupId: group.id,
      title: group.title || '',
      color: group.color,
      collapsed: group.collapsed,
    }
  }
}
