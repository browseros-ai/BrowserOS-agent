import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { z } from 'zod'
import { MessageType } from '@/lib/types/messaging'
import { PortName } from '@/lib/runtime/PortMessaging'
import { Agent } from '../stores/agentsStore'
import { Logging } from '@/lib/utils/Logging'

// Provider schema
export const ProviderSchema = z.object({
  id: z.string(),  // Unique identifier
  name: z.string(),  // Display name
  category: z.enum(['llm', 'search']),  // Category for grouping
  actionType: z.enum(['url', 'sidepanel']),  // How to handle the provider
  urlPattern: z.string().optional(),  // URL pattern for navigation (use %s for query placeholder)
  searchParam: z.string().optional(),  // Query parameter name (e.g., 'q' for ?q=query)
  available: z.boolean().default(true),  // Is provider available
  isCustom: z.boolean().optional()  // Is this a custom provider
})

export type Provider = z.infer<typeof ProviderSchema>

// Default providers list
const DEFAULT_PROVIDERS: Provider[] = [
  {
    id: 'browseros-agent',
    name: 'BrowserOS Agent',
    category: 'llm',
    actionType: 'sidepanel',
    available: true
  },
  {
    id: 'chatgpt',
    name: 'ChatGPT',
    category: 'llm',
    actionType: 'url',
    urlPattern: 'https://chatgpt.com/?q=%s',
    available: true
  },
  {
    id: 'claude',
    name: 'Claude',
    category: 'llm',
    actionType: 'url',
    urlPattern: 'https://claude.ai/new?q=%s',
    available: true
  },
  {
    id: 'grok',
    name: 'Grok',
    category: 'llm',
    actionType: 'url',
    urlPattern: 'https://x.com/i/grok?text=%s',
    available: true
  },
  {
    id: 'google',
    name: 'Google',
    category: 'search',
    actionType: 'url',
    urlPattern: 'https://www.google.com/search?q=%s',
    available: true
  },
  {
    id: 'perplexity',
    name: 'Perplexity',
    category: 'llm',
    actionType: 'url',
    urlPattern: 'https://www.perplexity.ai/?q=%s',
    available: true
  },
  {
    id: 'duckduckgo',
    name: 'DuckDuckGo',
    category: 'search',
    actionType: 'url',
    urlPattern: 'https://duckduckgo.com/?q=%s',
    available: true
  }
]

interface ProviderState {
  providers: Provider[]
  customProviders: Provider[]
  selectedProviderId: string
  isDropdownOpen: boolean
}

interface ProviderActions {
  selectProvider: (id: string) => void
  toggleDropdown: () => void
  closeDropdown: () => void
  getSelectedProvider: () => Provider | undefined
  getProvidersByCategory: (category: 'llm' | 'search') => Provider[]
  addCustomProvider: (provider: Omit<Provider, 'id' | 'isCustom' | 'available'>) => void
  removeCustomProvider: (id: string) => void
  getAllProviders: () => Provider[]
  executeProviderAction: (provider: Provider, query: string) => Promise<void>
  executeAgent: (agent: Agent, query: string, isBuilder?: boolean) => Promise<void>
}

export const useProviderStore = create<ProviderState & ProviderActions>()(
  persist(
    (set, get) => ({
      // Initial state
      providers: DEFAULT_PROVIDERS,
      customProviders: [],
      selectedProviderId: 'browseros-agent',
      isDropdownOpen: false,
      
      // Actions
      selectProvider: (id) => {
        set({ selectedProviderId: id, isDropdownOpen: false })
      },
      
      toggleDropdown: () => set(state => ({ isDropdownOpen: !state.isDropdownOpen })),
      
      closeDropdown: () => set({ isDropdownOpen: false }),
      
      getSelectedProvider: () => {
        const state = get()
        const allProviders = [...state.providers, ...state.customProviders]
        return allProviders.find(p => p.id === state.selectedProviderId)
      },
      
      getProvidersByCategory: (category) => {
        const state = get()
        const allProviders = [...state.providers, ...state.customProviders]
        return allProviders.filter(p => p.category === category)
      },
      
      addCustomProvider: (provider) => {
        const id = crypto.randomUUID()
        const newProvider: Provider = {
          ...provider,
          id,
          isCustom: true,
          available: true
        }
        set(state => ({
          customProviders: [...state.customProviders, newProvider]
        }))
      },
      
      removeCustomProvider: (id) => {
        set(state => ({
          customProviders: state.customProviders.filter(p => p.id !== id),
          // If the removed provider was selected, select the default
          selectedProviderId: state.selectedProviderId === id ? 'browseros-agent' : state.selectedProviderId
        }))
      },
      
      getAllProviders: () => {
        const state = get()
        return [...state.providers, ...state.customProviders]
      },
      
      executeProviderAction: async (provider, query) => {
        Logging.logMetric('newtab.execute_provider', {
          providerName: provider.name,
          actionType: provider.actionType
        })
        
        // URL-based providers (both custom and built-in)
        if (provider.actionType === 'url' && provider.urlPattern) {
          const url = provider.urlPattern.replace('%s', encodeURIComponent(query))
          
          // Update current tab
          const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true })
          if (activeTab?.id) {
            await chrome.tabs.update(activeTab.id, { url })
          }
        } 
        // Sidepanel provider (BrowserOS Agent)
        else if (provider.actionType === 'sidepanel') {
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
                metadata: {
                  source: 'newtab',
                  executionMode: 'dynamic'
                }
              }
            })
            
            // Close port after sending message
            setTimeout(() => port.disconnect(), 100)
          } catch (error) {
            console.error('Failed to open sidepanel with query:', error)
          }
        } else {
          console.warn(`No action defined for provider: ${provider.id}`)
        }
      },
      
      executeAgent: async (agent, query, isBuilder) => {
        Logging.logMetric('newtab.execute_agent', {
          agentName: agent.name
        })
        
        try {
          // Get current tab
          const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true })
          
          if (!activeTab?.id) {
            console.error('No active tab found')
            return
          }
          
          // Prepend "Create new tab" if running from builder
          const finalSteps = isBuilder 
            ? ['Create new tab', ...agent.steps]
            : agent.steps
          
          // Open the sidepanel for the current tab
          await chrome.sidePanel.open({ tabId: activeTab.id })
          
          // Wait a bit for sidepanel to initialize
          await new Promise(resolve => setTimeout(resolve, 500))
          
          // Connect to background script and send query with agent metadata
          const port = chrome.runtime.connect({ name: PortName.NEWTAB_TO_BACKGROUND })
          
          // Send the query through port messaging with predefined plan
          port.postMessage({
            type: MessageType.EXECUTE_QUERY,
            payload: {
              query: query,
              tabIds: [activeTab.id],
              metadata: {
                source: 'newtab',
                executionMode: 'predefined',
                predefinedPlan: {
                  agentId: agent.id,
                  steps: finalSteps,
                  goal: agent.goal,
                  name: agent.name
                }
              }
            }
          })
          
          // Close port after sending message
          setTimeout(() => port.disconnect(), 100)
        } catch (error) {
          console.error('Failed to execute agent:', error)
        }
      }
    }),
    {
      name: 'browseros-providers',
      version: 1
    }
  )
)
