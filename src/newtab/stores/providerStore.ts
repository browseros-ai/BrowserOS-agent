import { create } from 'zustand'
import { z } from 'zod'

// Provider schema
export const ProviderSchema = z.object({
  id: z.string(),  // Unique identifier
  name: z.string(),  // Display name
  type: z.string(),  // Provider type (browseros, openai, anthropic, etc.)
  category: z.enum(['llm', 'search']),  // Category for grouping
  modelId: z.string().optional(),  // Model identifier
  available: z.boolean().default(true)  // Is provider available
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
    id: 'claude',
    name: 'Claude',
    type: 'anthropic',
    category: 'llm',
    modelId: 'claude-3-5-sonnet',
    available: true
  },
  {
    id: 'grok',
    name: 'Grok',
    type: 'xai',
    category: 'llm',
    available: true
  },
  {
    id: 'gemini',
    name: 'Gemini',
    type: 'google',
    category: 'llm',
    available: true
  },
  {
    id: 'perplexity',
    name: 'Perplexity',
    type: 'perplexity',
    category: 'llm',
    available: true
  }
]

interface ProviderState {
  providers: Provider[]
  selectedProviderId: string
  isDropdownOpen: boolean
}

interface ProviderActions {
  selectProvider: (id: string) => void
  toggleDropdown: () => void
  closeDropdown: () => void
  getSelectedProvider: () => Provider | undefined
  getProvidersByCategory: (category: 'llm' | 'search') => Provider[]
}

export const useProviderStore = create<ProviderState & ProviderActions>((set, get) => ({
  // Initial state
  providers: DEFAULT_PROVIDERS,
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
    return state.providers.find(p => p.id === state.selectedProviderId)
  },
  
  getProvidersByCategory: (category) => {
    return get().providers.filter(p => p.category === category)
  }
}))