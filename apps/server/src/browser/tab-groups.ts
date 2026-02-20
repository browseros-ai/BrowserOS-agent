import type { ControllerBackend } from './backends/types'

export interface TabGroup {
  id: number
  windowId: number
  title: string
  color: string
  collapsed: boolean
  tabIds: number[]
}

export async function listTabGroups(
  controller: ControllerBackend,
): Promise<TabGroup[]> {
  const result = await controller.send('listTabGroups', {})
  const data = result as { groups: TabGroup[] }
  return data.groups
}

export async function groupTabs(
  controller: ControllerBackend,
  tabIds: number[],
  opts?: { title?: string; color?: string; groupId?: number },
): Promise<TabGroup> {
  const result = await controller.send('groupTabs', {
    tabIds,
    ...opts,
  })
  return result as TabGroup
}

export async function updateTabGroup(
  controller: ControllerBackend,
  groupId: number,
  opts: { title?: string; color?: string; collapsed?: boolean },
): Promise<TabGroup> {
  const result = await controller.send('updateTabGroup', {
    groupId,
    ...opts,
  })
  return result as TabGroup
}

export async function ungroupTabs(
  controller: ControllerBackend,
  tabIds: number[],
): Promise<{ ungroupedCount: number }> {
  const result = await controller.send('ungroupTabs', { tabIds })
  return result as { ungroupedCount: number }
}
