import { create } from 'zustand'
import { z } from 'zod'
import { Logging } from '@/lib/utils/Logging'

// Agent schema following v2 patterns
export const AgentSchema = z.object({
  id: z.string().min(1),  // Unique identifier
  name: z.string().min(2).max(50),  // Display name
  description: z.string().max(200),  // Brief description
  goal: z.string().min(10),  // Primary objective
  steps: z.array(z.string()).default([]),  // Execution steps
  notes: z.array(z.string()).optional(),  // Additional notes and context
  tools: z.array(z.string()).default([]),  // Tool identifiers (future)
  isPinned: z.boolean().default(false),  // Show on new tab
  lastUsed: z.number().int().nullable(),  // Last execution timestamp
  createdAt: z.number().int(),  // Creation timestamp
  updatedAt: z.number().int()  // Last update timestamp
})

export type Agent = z.infer<typeof AgentSchema>

// Store state
interface AgentsState {
  agents: Agent[]
  selectedAgentId: string | null
  isCreating: boolean
}

// Store actions
interface AgentsActions {
  // CRUD operations
  addAgent: (agent: Omit<Agent, 'id' | 'createdAt' | 'updatedAt'>) => void
  updateAgent: (id: string, updates: Partial<Agent>) => void
  deleteAgent: (id: string) => void
  
  // Selection
  selectAgent: (id: string | null) => void
  
  // Pinning
  togglePin: (id: string) => void
  
  // Creation state
  setCreating: (creating: boolean) => void
  
  // Bulk operations
  loadAgents: (agents: Agent[]) => void
}

// Create store following v2 patterns
export const useAgentsStore = create<AgentsState & AgentsActions>((set, get) => ({
  // Initial state
  agents: [],
  selectedAgentId: null,
  isCreating: false,
  
  // Actions implementation
  addAgent: (agentData) => {
    const newAgent: Agent = {
      ...agentData,
      id: crypto.randomUUID(),
      createdAt: Date.now(),
      updatedAt: Date.now()
    }
    
    set(state => ({
      agents: [...state.agents, newAgent],
      selectedAgentId: newAgent.id
    }))
    
    // Log metric for agent creation
    Logging.logMetric('custom_agent.created', {
      name: newAgent.name,
      description: newAgent.description,
      goal: newAgent.goal,
      steps: newAgent.steps,
      tools: newAgent.tools
    })
    
    // Persist to storage
    // get().agents already includes the newly added agent after set()
    chrome.storage.local.set({ agents: get().agents })
  },
  
  updateAgent: (id, updates) => {
    set(state => ({
      agents: state.agents.map(agent =>
        agent.id === id 
          ? { ...agent, ...updates, updatedAt: Date.now() }
          : agent
      )
    }))
    
    // Find the updated agent to log its properties
    const updatedAgent = get().agents.find(agent => agent.id === id)
    if (updatedAgent) {
      // Log metric for agent update with 10% sampling
      Logging.logMetric('custom_agent.updated', {
        name: updatedAgent.name,
        description: updatedAgent.description,
        goal: updatedAgent.goal,
        steps: updatedAgent.steps,
        tools: updatedAgent.tools
      }, 0.1)
    }
    
    // Persist changes
    chrome.storage.local.set({ agents: get().agents })
  },
  
  deleteAgent: (id) => {
    set(state => ({
      agents: state.agents.filter(agent => agent.id !== id),
      selectedAgentId: state.selectedAgentId === id ? null : state.selectedAgentId
    }))
    
    chrome.storage.local.set({ agents: get().agents })
  },
  
  selectAgent: (id) => set({ selectedAgentId: id }),
  
  togglePin: (id) => {
    set(state => ({
      agents: state.agents.map(agent =>
        agent.id === id 
          ? { ...agent, isPinned: !agent.isPinned, updatedAt: Date.now() }
          : agent
      )
    }))
    
    chrome.storage.local.set({ agents: get().agents })
  },
  
  setCreating: (creating) => set({ isCreating: creating }),
  
  loadAgents: (agents) => set({ agents })
}))

// Selectors for common queries
export const agentSelectors = {
  getPinnedAgents: (state: AgentsState) =>
    state.agents.filter(agent => agent.isPinned),
    
  getRecentAgents: (state: AgentsState, limit = 5) =>
    [...state.agents]
      .sort((a, b) => (b.lastUsed || 0) - (a.lastUsed || 0))
      .slice(0, limit),
      
  getSelectedAgent: (state: AgentsState) =>
    state.agents.find(agent => agent.id === state.selectedAgentId)
}
