/**
 * @public
 */
export async function isSidePanelOpen(tabId: number): Promise<boolean> {
  // @ts-expect-error browserosIsOpen is a BrowserOS-specific API
  return await chrome.sidePanel.browserosIsOpen({ tabId })
}

/**
 * @public
 */
export async function openSidePanel(
  tabId: number,
): Promise<{ opened: boolean }> {
  const isAlreadyOpen = await isSidePanelOpen(tabId)
  if (isAlreadyOpen) {
    return { opened: true }
  }
  // @ts-expect-error browserosToggle is a BrowserOS-specific API
  return await chrome.sidePanel.browserosToggle({ tabId })
}

/**
 * @public
 */
export async function toggleSidePanel(
  tabId: number,
): Promise<{ opened: boolean }> {
  // @ts-expect-error browserosToggle is a BrowserOS-specific API
  return await chrome.sidePanel.browserosToggle({ tabId })
}
