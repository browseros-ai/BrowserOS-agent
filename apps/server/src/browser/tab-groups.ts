import type { CdpBackend } from './backends/types'

export interface TabGroup {
  id: string
  windowId: number
  title: string
  color: string
  collapsed: boolean
  tabIds: number[]
}

export async function listTabGroups(cdp: CdpBackend): Promise<TabGroup[]> {
  const result = await cdp.send('Browser.getTabGroups')
  const data = result as { groups: TabGroup[] }
  return data.groups
}

export async function groupTabs(
  cdp: CdpBackend,
  tabIds: number[],
  opts?: { title?: string; color?: string; groupId?: string },
): Promise<TabGroup> {
  if (opts?.groupId) {
    const result = await cdp.send('Browser.addTabsToGroup', {
      groupId: opts.groupId,
      tabIds,
    })
    return result as TabGroup
  }

  const result = await cdp.send('Browser.createTabGroup', {
    tabIds,
    ...(opts?.title !== undefined && { title: opts.title }),
    ...(opts?.color !== undefined && { color: opts.color }),
  })
  return result as TabGroup
}

export async function updateTabGroup(
  cdp: CdpBackend,
  groupId: string,
  opts: { title?: string; color?: string; collapsed?: boolean },
): Promise<TabGroup> {
  const result = await cdp.send('Browser.updateTabGroup', {
    groupId,
    ...opts,
  })
  return result as TabGroup
}

export async function ungroupTabs(
  cdp: CdpBackend,
  tabIds: number[],
): Promise<{ ungroupedCount: number }> {
  const result = await cdp.send('Browser.removeTabsFromGroup', { tabIds })
  return result as { ungroupedCount: number }
}

export async function closeTabGroup(
  cdp: CdpBackend,
  groupId: string,
): Promise<void> {
  await cdp.send('Browser.closeTabGroup', { groupId })
}
