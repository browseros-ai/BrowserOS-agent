import { create } from 'zustand'
import { z } from 'zod'

// Browser Tab schema
export const BrowserTabSchema = z.object({
  id: z.number(),  // Chrome tab ID
  title: z.string(),  // Tab title
  url: z.string(),  // Tab URL
  favIconUrl: z.string().optional(),  // Favicon URL
  active: z.boolean().optional(),  // Is tab currently active
  windowId: z.number().optional()  // Window ID the tab belongs to
})

export type BrowserTab = z.infer<typeof BrowserTabSchema>

// Utility to check whether a tab is a valid http/https page
const isValidTab = (tab: BrowserTab): boolean => {
  return tab.url.startsWith('http://') || tab.url.startsWith('https://')
}

// Intent predictions schema
export const IntentPredictionSchema = z.object({
  tabId: z.number(),  // Tab ID the predictions are for
  url: z.string(),  // URL of the page
  intents: z.array(z.string()),  // Predicted intents
  confidence: z.number().optional(),  // Confidence score
  timestamp: z.number(),  // When prediction was made
  error: z.string().optional()  // Error message if prediction failed
})

export type IntentPrediction = z.infer<typeof IntentPredictionSchema>

// Store state type
interface TabsState {
  // All valid open tabs in the current window
  openTabs: BrowserTab[]
  // ID of the tab that hosts the side-panel itself (may be null when unknown)
  currentTabId: number | null
  // IDs selected by the user for context
  selectedTabs: number[]
  // Whether the user explicitly removed the current tab from context
  isCurrentTabRemoved: boolean
  // Timestamp of the last successful fetch (ms since epoch)
  lastFetch: number
  // Intent predictions keyed by tab ID
  intentPredictions: Map<number, IntentPrediction>

  // ----- Actions -----
  fetchOpenTabs: (getTabsFn?: () => Promise<BrowserTab[]>, force?: boolean) => Promise<void>
  toggleTabSelection: (tabId: number) => void
  clearSelectedTabs: () => void
  getContextTabs: () => BrowserTab[]
  updateIntentPredictions: (prediction: IntentPrediction) => void
  getIntentPredictionsForTab: (tabId: number) => IntentPrediction | null
  clearIntentPredictions: () => void
}

export const useTabsStore = create<TabsState>((set, get) => ({
  openTabs: [],
  currentTabId: null,
  selectedTabs: [],
  isCurrentTabRemoved: false,
  lastFetch: 0,
  intentPredictions: new Map(),

  // Fetch list of open tabs (throttled to every 5 seconds)
  async fetchOpenTabs(getTabsFn?: () => Promise<BrowserTab[]>, force = false) {
    const { lastFetch } = get()
    const now = Date.now()
    if (!force && now - lastFetch < 5000) return

    try {
      // Use provided getter or fall back to chrome.tabs.query
      let rawTabs: BrowserTab[]
      if (getTabsFn) {
        rawTabs = await getTabsFn()
      } else {
        const chromeTabs = await chrome.tabs.query({ currentWindow: true })
        rawTabs = chromeTabs.map(tab => ({
          id: tab.id!,
          title: tab.title || 'Untitled',
          url: tab.url || '',
          favIconUrl: tab.favIconUrl || undefined,
          active: tab.active,
          windowId: tab.windowId
        })) as BrowserTab[]
      }

      // Filter invalid tabs and update store
      const validTabs = rawTabs.filter(isValidTab)
      let currentTabId: number | null = null
      const activeTab = validTabs.find(t => t.active)
      if (activeTab) currentTabId = activeTab.id

      set({
        openTabs: validTabs,
        currentTabId,
        lastFetch: now
      })
    } catch (err) {
      // Swallow errors here – UI can display its own message
      console.error('[tabsStore] Failed to fetch tabs', err)
    }
  },

  // Toggle selection status of a tab
  toggleTabSelection(tabId: number) {
    const { selectedTabs, currentTabId, isCurrentTabRemoved } = get()
    const isSelected = selectedTabs.includes(tabId)
    let newSelected: number[]

    if (isSelected) {
      newSelected = selectedTabs.filter(id => id !== tabId)
    } else {
      newSelected = [...selectedTabs, tabId]
    }

    // Handle special case for current tab
    let newIsCurrentTabRemoved = isCurrentTabRemoved
    if (currentTabId !== null && tabId === currentTabId) {
      newIsCurrentTabRemoved = isSelected // removed when it was selected, added when it was not
    }

    set({
      selectedTabs: newSelected,
      isCurrentTabRemoved: newIsCurrentTabRemoved
    })
  },

  // Clear all user selections
  clearSelectedTabs() {
    set({ selectedTabs: [], isCurrentTabRemoved: false })
  },

  // Return selected + current tab (unless removed) as full BrowserTab objects
  getContextTabs() {
    const { openTabs, selectedTabs, currentTabId, isCurrentTabRemoved } = get()
    const ids = new Set<number>(selectedTabs)

    if (currentTabId !== null && !isCurrentTabRemoved) {
      ids.add(currentTabId)
    }

    return openTabs.filter(tab => ids.has(tab.id))
  },

  // Update intent predictions for a tab
  updateIntentPredictions(prediction: IntentPrediction) {
    set(state => {
      const newPredictions = new Map(state.intentPredictions)
      newPredictions.set(prediction.tabId, prediction)
      return { intentPredictions: newPredictions }
    })
  },

  // Get intent predictions for a specific tab
  getIntentPredictionsForTab(tabId: number) {
    return get().intentPredictions.get(tabId) || null
  },

  // Clear all intent predictions
  clearIntentPredictions() {
    set({ intentPredictions: new Map() })
  }
})) 