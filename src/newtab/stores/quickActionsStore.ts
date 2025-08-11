import { create } from 'zustand'
import { z } from 'zod'

// Quick action types
export const QuickActionSchema = z.object({
  id: z.string(),  // Unique identifier
  type: z.enum(['search', 'agent', 'skill', 'tab']),  // Action type
  label: z.string(),  // Display label
  icon: z.string().optional(),  // Icon identifier
  action: z.string(),  // Action command or URL
  count: z.number().int().default(0)  // Usage count for sorting
})

export type QuickAction = z.infer<typeof QuickActionSchema>

interface QuickActionsState {
  recentActions: QuickAction[]
  suggestedActions: QuickAction[]
}

interface QuickActionsActions {
  addRecentAction: (action: QuickAction) => void
  clearRecentActions: () => void
  loadSuggestions: () => void
}

export const useQuickActionsStore = create<QuickActionsState & QuickActionsActions>((set) => ({
  recentActions: [],
  suggestedActions: [
    { id: 'qa-1', type: 'search', label: 'Search Google', action: 'google.com', count: 0 },
    { id: 'qa-2', type: 'skill', label: 'Summarize Page', action: 'summarize', count: 0 },
    { id: 'qa-3', type: 'skill', label: 'Extract Links', action: 'extract-links', count: 0 }
  ],
  
  addRecentAction: (action) => {
    set(state => ({
      recentActions: [
        action,
        ...state.recentActions.filter(a => a.id !== action.id)
      ].slice(0, 10)  // Keep only 10 recent actions
    }))
  },
  
  clearRecentActions: () => set({ recentActions: [] }),
  
  loadSuggestions: () => {
    // Load context-aware suggestions based on current tabs, time of day, etc.
    // This is a placeholder for future enhancement
  }
}))