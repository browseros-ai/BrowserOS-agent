/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import { z } from 'zod'
import { TabAdapter } from '@/adapters/TabAdapter'
import { ActionHandler } from '../ActionHandler'

const UngroupTabsInputSchema = z
  .object({
    tabIds: z
      .array(z.number().int().positive())
      .min(1)
      .describe('Array of tab IDs to remove from their groups'),
  })
  .describe('Remove tabs from their groups')

type UngroupTabsInput = z.infer<typeof UngroupTabsInputSchema>

export interface UngroupTabsOutput {
  ungroupedCount: number
}

/**
 * UngroupTabsAction - Remove tabs from their groups
 *
 * Removes the specified tabs from any groups they belong to.
 * The tabs remain open but are no longer part of any group.
 *
 * Example payload:
 * { "tabIds": [123, 456, 789] }
 */
export class UngroupTabsAction extends ActionHandler<
  UngroupTabsInput,
  UngroupTabsOutput
> {
  readonly inputSchema = UngroupTabsInputSchema
  private tabAdapter = new TabAdapter()

  async execute(input: UngroupTabsInput): Promise<UngroupTabsOutput> {
    await this.tabAdapter.ungroupTabs(input.tabIds)

    return {
      ungroupedCount: input.tabIds.length,
    }
  }
}
