import { Capabilities } from '@/lib/browseros/capabilities'
import { getHealthCheckUrl, getMcpServerUrl } from '@/lib/browseros/helpers'
import { openSidePanel, toggleSidePanel } from '@/lib/browseros/toggleSidePanel'
import { setupLlmProvidersBackupToBrowserOS } from '@/lib/llm-providers/storage'
import { fetchMcpTools } from '@/lib/mcp/client'
import { onServerMessage } from '@/lib/messaging/server/serverMessages'
import { onOpenSidePanelWithSearch } from '@/lib/messaging/sidepanel/openSidepanelWithSearch'
import { searchActionsStorage } from '@/lib/search-actions/searchActionsStorage'

export default defineBackground(async () => {
  chrome.sidePanel.setOptions({ enabled: false })

  await Capabilities.initialize()
  setupLlmProvidersBackupToBrowserOS()

  chrome.action.onClicked.addListener(async (tab) => {
    if (tab.id) {
      await toggleSidePanel(tab.id)
    }
  })

  onOpenSidePanelWithSearch('open', async (messageData) => {
    const currentTabsList = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    })
    const currentTab = currentTabsList?.[0]?.id
    if (currentTab) {
      const { opened } = await openSidePanel(currentTab)

      if (opened) {
        setTimeout(() => {
          searchActionsStorage.setValue(messageData.data)
        }, 500)
      }
    }
  })

  chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === chrome.runtime.OnInstalledReason.INSTALL) {
      chrome.tabs.create({
        url: chrome.runtime.getURL('onboarding.html'),
      })
    }
  })

  onServerMessage('checkHealth', async () => {
    try {
      const url = await getHealthCheckUrl()
      const response = await fetch(url)
      return { healthy: response.ok }
    } catch {
      return { healthy: false }
    }
  })

  onServerMessage('fetchMcpTools', async () => {
    try {
      const url = await getMcpServerUrl()
      const tools = await fetchMcpTools(url)
      return { tools }
    } catch (err) {
      return {
        tools: [],
        error: err instanceof Error ? err.message : 'Failed to fetch tools',
      }
    }
  })
})
