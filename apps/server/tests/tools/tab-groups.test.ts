import { describe, it } from 'bun:test'
import assert from 'node:assert'
import { close_page, new_page } from '../../src/tools/navigation'
import {
  close_tab_group,
  group_tabs,
  list_tab_groups,
  ungroup_tabs,
  update_tab_group,
} from '../../src/tools/tab-groups'
import { withBrowser } from '../__helpers__/with-browser'

function textOf(result: {
  content: { type: string; text?: string }[]
}): string {
  return result.content
    .filter((c) => c.type === 'text')
    .map((c) => c.text)
    .join('\n')
}

describe('tab group tools', () => {
  it('list_tab_groups returns without error', async () => {
    await withBrowser(async ({ execute }) => {
      const result = await execute(list_tab_groups, {})
      assert.ok(!result.isError, textOf(result))
    })
  }, 60_000)

  it('group, update, ungroup lifecycle', async () => {
    await withBrowser(async ({ execute }) => {
      // Create two tabs to group
      const tab1Result = await execute(new_page, { url: 'about:blank' })
      const tab1PageId = Number(
        textOf(tab1Result).match(/Page ID:\s*(\d+)/)?.[1],
      )

      const tab2Result = await execute(new_page, { url: 'about:blank' })
      const tab2PageId = Number(
        textOf(tab2Result).match(/Page ID:\s*(\d+)/)?.[1],
      )

      const pageIds = [tab1PageId, tab2PageId]

      // Group tabs
      const groupResult = await execute(group_tabs, {
        pageIds,
        title: 'Test Group',
      })
      assert.ok(!groupResult.isError, textOf(groupResult))
      const groupText = textOf(groupResult)
      assert.ok(groupText.includes('Test Group'))
      const groupIdMatch = groupText.match(/Group ID:\s*(\S+)/)
      assert.ok(groupIdMatch, 'Could not extract group ID')
      const groupId = groupIdMatch?.[1]

      // Update group
      const updateResult = await execute(update_tab_group, {
        groupId,
        title: 'Renamed Group',
        color: 'blue',
      })
      assert.ok(!updateResult.isError, textOf(updateResult))
      assert.ok(textOf(updateResult).includes('Renamed Group'))

      // Verify in list
      const listResult = await execute(list_tab_groups, {})
      assert.ok(!listResult.isError, textOf(listResult))
      assert.ok(textOf(listResult).includes('Renamed Group'))

      // Ungroup
      const ungroupResult = await execute(ungroup_tabs, { pageIds })
      assert.ok(!ungroupResult.isError, textOf(ungroupResult))
      assert.ok(textOf(ungroupResult).includes('Ungrouped'))

      // Cleanup
      await execute(close_page, { page: tab1PageId })
      await execute(close_page, { page: tab2PageId })
    })
  }, 60_000)

  it('close_tab_group closes group and tabs', async () => {
    await withBrowser(async ({ execute }) => {
      const tabResult = await execute(new_page, { url: 'about:blank' })
      const tabPageId = Number(textOf(tabResult).match(/Page ID:\s*(\d+)/)?.[1])

      // Group
      const groupResult = await execute(group_tabs, {
        pageIds: [tabPageId],
        title: 'Disposable',
      })
      assert.ok(!groupResult.isError, textOf(groupResult))
      const groupId = textOf(groupResult).match(/Group ID:\s*(\S+)/)?.[1]

      // Close group (also closes the tab)
      const closeResult = await execute(close_tab_group, { groupId })
      assert.ok(!closeResult.isError, textOf(closeResult))
      assert.ok(textOf(closeResult).includes('Closed tab group'))
    })
  }, 60_000)
})
