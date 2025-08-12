import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { z } from 'zod'

// Provider schema
export const ProviderSchema = z.object({
  id: z.string(),  // Unique identifier
  name: z.string(),  // Display name
  type: z.enum(['custom', 'browseros', 'openai', 'anthropic', 'llm', 'google', 'perplexity', 'duckduckgo']),  // Provider type
  category: z.enum(['llm', 'search']),  // Category for grouping
  modelId: z.string().optional(),  // Model identifier
  available: z.boolean().default(true),  // Is provider available
  isCustom: z.boolean().optional(),  // Is this a custom provider
  urlPattern: z.string().optional()  // URL pattern for custom providers (with %s for query)
})

export type Provider = z.infer<typeof ProviderSchema>

// Default providers list - matching the dropdown image
const DEFAULT_PROVIDERS: Provider[] = [
  // LLM Providers
  {
    id: 'browseros-agent',
    name: 'BrowserOS Agent',
    type: 'browseros',
    category: 'llm',
    modelId: 'browseros-agent',
    available: true
  },
  {
    id: 'chatgpt',
    name: 'ChatGPT',
    type: 'openai',
    category: 'llm',
    modelId: 'gpt-4o',
    available: true
  },
  {
    id: 'google',
    name: 'Google',
    type: 'google',
    category: 'search',  // Google as search provider
    available: true
  },
  {
    id: 'perplexity',
    name: 'Perplexity',
    type: 'perplexity',
    category: 'llm',
    available: true
  },
  {
    id: 'duckduckgo',
    name: 'DuckDuckGo',
    type: 'duckduckgo',
    category: 'search',
    available: true
  },
  {
    id: 'grok',
    name: 'Grok',
    type: 'llm',
    category: 'llm',  // Back to LLM category for Grok
    available: true
  },
  {
    id: 'claude',
    name: 'Claude',
    type: 'anthropic',
    category: 'llm',
    modelId: 'claude-3-5-sonnet',
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
  addCustomProvider: (provider: Omit<Provider, 'id' | 'isCustom' | 'type' | 'available'>) => void
  removeCustomProvider: (id: string) => void
  getAllProviders: () => Provider[]
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
        const id = `custom-${Date.now()}`
        const newProvider: Provider = {
          ...provider,
          id,
          type: 'custom',
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
      }
    }),
    {
      name: 'nxtscape-providers',
      version: 1
    }
  )
)
