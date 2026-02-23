import type { CdpBackend } from './backends/types'

export interface TabGroup {
  groupId: string
  windowId: number
  title: string
  color: string
  collapsed: boolean
  tabIds: number[]
}

export async function listTabGroups(cdp: CdpBackend): Promise<TabGroup[]> {
  const result = await cdp.Browser.getTabGroups()
  return result.groups as TabGroup[]
}

export async function groupTabs(
  cdp: CdpBackend,
  tabIds: number[],
  opts?: { title?: string; groupId?: string },
): Promise<TabGroup> {
  if (opts?.groupId) {
    const result = await cdp.Browser.addTabsToGroup({
      groupId: opts.groupId,
      tabIds,
    })
    return result.group as TabGroup
  }

  const result = await cdp.Browser.createTabGroup({
    tabIds,
    ...(opts?.title !== undefined && { title: opts.title }),
  })
  return result.group as TabGroup
}

export async function updateTabGroup(
  cdp: CdpBackend,
  groupId: string,
  opts: { title?: string; color?: string; collapsed?: boolean },
): Promise<TabGroup> {
  const result = await cdp.Browser.updateTabGroup({ groupId, ...opts })
  return result.group as TabGroup
}

export async function ungroupTabs(
  cdp: CdpBackend,
  tabIds: number[],
): Promise<void> {
  await cdp.Browser.removeTabsFromGroup({ tabIds })
}

export async function closeTabGroup(
  cdp: CdpBackend,
  groupId: string,
): Promise<void> {
  await cdp.Browser.closeTabGroup({ groupId })
}
