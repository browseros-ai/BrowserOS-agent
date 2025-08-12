import { Provider } from '../stores/providerStore'
import { MessageType } from '@/lib/types/messaging'
import { PortName } from '@/lib/runtime/PortMessaging'

// Provider URL patterns for external services
const PROVIDER_ACTIONS: Record<string, { 
  type: 'url' | 'sidepanel', 
  urlPattern?: string,
  searchParam?: string 
}> = {
  'chatgpt': {
    type: 'url',
    urlPattern: 'https://chatgpt.com/',
    searchParam: 'q'
  },
  'claude': {
    type: 'url',
    urlPattern: 'https://claude.ai/new',
    searchParam: 'q'
  },
  'grok': {
    type: 'url',
    urlPattern: 'https://x.com/i/grok',
    searchParam: 'text'
  },
  'gemini': {
    type: 'url',
    urlPattern: 'https://gemini.google.com/app',
    searchParam: 'q'
  },
  'perplexity': {
    type: 'url',
    urlPattern: 'https://www.perplexity.ai/',
    searchParam: 'q'
  },
  'browseros-agent': {
    type: 'sidepanel'
  }
}

/**
 * Execute provider-specific action with the given query
 */
export async function executeProviderAction(provider: Provider, query: string): Promise<void> {
  const action = PROVIDER_ACTIONS[provider.id]
  
  if (!action) {
    console.warn(`No action defined for provider: ${provider.id}`)
    return
  }
  
  if (action.type === 'url' && action.urlPattern) {
    // Open external provider in new tab with query
    const url = new URL(action.urlPattern)
    if (action.searchParam) {
      url.searchParams.set(action.searchParam, query)
    }
    
    await chrome.tabs.create({ 
      url: url.toString(),
      active: true 
    })
  } else if (action.type === 'sidepanel') {
    // Open sidepanel and send query to BrowserOS Agent
    await openSidePanelWithQuery(query)
  }
}

/**
 * Opens the sidepanel and sends a query to BrowserOS Agent
 */
async function openSidePanelWithQuery(query: string): Promise<void> {
  try {
    // Get current tab
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true })
    
    if (!activeTab?.id) {
      console.error('No active tab found')
      return
    }
    
    // Open the sidepanel for the current tab
    await chrome.sidePanel.open({ tabId: activeTab.id })
    
    // Wait a bit for sidepanel to initialize
    await new Promise(resolve => setTimeout(resolve, 500))
    
    // Connect to background script and send query
    const port = chrome.runtime.connect({ name: PortName.NEWTAB_TO_BACKGROUND })
    
    // Send the query through port messaging
    port.postMessage({
      type: MessageType.EXECUTE_QUERY,
      payload: {
        query: query,
        tabIds: [activeTab.id],
        source: 'newtab'
      }
    })
    
    // Close port after sending message
    setTimeout(() => port.disconnect(), 100)
  } catch (error) {
    console.error('Failed to open sidepanel with query:', error)
  }
}