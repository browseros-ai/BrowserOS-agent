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

function structuredOf<T>(result: { structuredContent?: unknown }): T {
  assert.ok(result.structuredContent, 'Expected structuredContent')
  return result.structuredContent as T
}

describe('tab group tools', () => {
  it('list_tab_groups returns without error', async () => {
    await withBrowser(async ({ execute }) => {
      const result = await execute(list_tab_groups, {})
      assert.ok(!result.isError, textOf(result))
      const data = structuredOf<{ groups: unknown[]; count: number }>(result)
      assert.ok(Array.isArray(data.groups))
      assert.ok(data.count >= 0)
    })
  }, 60_000)

  it('group, update, ungroup lifecycle', async () => {
    await withBrowser(async ({ execute }) => {
      // Create two tabs to group
      const tab1Result = await execute(new_page, { url: 'about:blank' })
      const tab1PageId = structuredOf<{ pageId: number }>(tab1Result).pageId

      const tab2Result = await execute(new_page, { url: 'about:blank' })
      const tab2PageId = structuredOf<{ pageId: number }>(tab2Result).pageId

      const pageIds = [tab1PageId, tab2PageId]

      // Group tabs
      const groupResult = await execute(group_tabs, {
        pageIds,
        title: 'Test Group',
      })
      assert.ok(!groupResult.isError, textOf(groupResult))
      const groupData = structuredOf<{
        group: { groupId: string; title: string; pageIds: number[] }
      }>(groupResult)
      assert.strictEqual(groupData.group.title, 'Test Group')
      assert.deepStrictEqual(groupData.group.pageIds.sort(), pageIds.sort())
      const groupId = groupData.group.groupId

      // Update group
      const updateResult = await execute(update_tab_group, {
        groupId,
        title: 'Renamed Group',
        color: 'blue',
      })
      assert.ok(!updateResult.isError, textOf(updateResult))
      const updateData = structuredOf<{
        group: { groupId: string; title: string; color: string }
      }>(updateResult)
      assert.strictEqual(updateData.group.groupId, groupId)
      assert.strictEqual(updateData.group.title, 'Renamed Group')
      assert.strictEqual(updateData.group.color, 'blue')

      // Verify in list
      const listResult = await execute(list_tab_groups, {})
      assert.ok(!listResult.isError, textOf(listResult))
      const listData = structuredOf<{
        groups: Array<{ groupId: string; title: string }>
      }>(listResult)
      assert.ok(
        listData.groups.some(
          (group) =>
            group.groupId === groupId && group.title === 'Renamed Group',
        ),
      )

      // Ungroup
      const ungroupResult = await execute(ungroup_tabs, { pageIds })
      assert.ok(!ungroupResult.isError, textOf(ungroupResult))
      const ungroupData = structuredOf<{ action: string; count: number }>(
        ungroupResult,
      )
      assert.strictEqual(ungroupData.action, 'ungroup_tabs')
      assert.strictEqual(ungroupData.count, 2)

      // Cleanup
      await execute(close_page, { page: tab1PageId })
      await execute(close_page, { page: tab2PageId })
    })
  }, 60_000)

  it('close_tab_group closes group and tabs', async () => {
    await withBrowser(async ({ execute }) => {
      const tabResult = await execute(new_page, { url: 'about:blank' })
      const tabPageId = structuredOf<{ pageId: number }>(tabResult).pageId

      // Group
      const groupResult = await execute(group_tabs, {
        pageIds: [tabPageId],
        title: 'Disposable',
      })
      assert.ok(!groupResult.isError, textOf(groupResult))
      const groupId = structuredOf<{ group: { groupId: string } }>(groupResult)
        .group.groupId

      // Close group (also closes the tab)
      const closeResult = await execute(close_tab_group, { groupId })
      assert.ok(!closeResult.isError, textOf(closeResult))
      const closeData = structuredOf<{ action: string; groupId: string }>(
        closeResult,
      )
      assert.strictEqual(closeData.action, 'close_tab_group')
      assert.strictEqual(closeData.groupId, groupId)
    })
  }, 60_000)
})
