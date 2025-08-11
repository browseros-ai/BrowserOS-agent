import React from 'react'
import { useQuickActionsStore } from '../stores/quickActionsStore'

export function QuickActions() {
  const { suggestedActions, recentActions } = useQuickActionsStore()
  
  const actions = recentActions.length > 0 
    ? recentActions.slice(0, 4)
    : suggestedActions.slice(0, 4)
  
  return (
    <div className="flex flex-wrap gap-2 justify-center">
      {actions.map(action => (
        <button
          key={action.id}
          className="
            px-4 py-2 
            bg-card border border-border rounded-full
            text-sm text-foreground
            hover:bg-accent hover:border-primary
            transition-all duration-200
            focus:ring-2 focus:ring-primary focus:outline-none
          "
          onClick={() => {
            // Execute the action
            console.log('Executing action:', action)
          }}
        >
          {action.label}
        </button>
      ))}
    </div>
  )
}