import React, { useEffect } from 'react'
import { CommandInput } from './components/CommandInput'
import { QuickActions } from './components/QuickActions'
import { AgentCard } from './components/AgentCard'
import { RecentsList } from './components/RecentsList'
import { useAgentsStore, agentSelectors } from './stores/agentsStore'
import { useQuickActionsStore } from './stores/quickActionsStore'
import { useSettingsStore } from '@/sidepanel/v2/stores/settingsStore'
import { useProviderStore } from './stores/providerStore'

export function NewTab() {
  const { theme, fontSize } = useSettingsStore()
  const pinnedAgents = useAgentsStore(agentSelectors.getPinnedAgents)
  const recentAgents = useAgentsStore(agentSelectors.getRecentAgents)
  const { loadSuggestions } = useQuickActionsStore()
  
  // Apply theme and font size
  useEffect(() => {
    document.documentElement.style.setProperty('--app-font-size', `${fontSize}px`)
    const root = document.documentElement
    root.classList.remove('dark', 'gray')
    if (theme === 'dark') root.classList.add('dark')
    if (theme === 'gray') root.classList.add('gray')
  }, [theme, fontSize])
  
  // Load suggestions on mount
  useEffect(() => {
    loadSuggestions()
  }, [loadSuggestions])
  
  return (
    <div className="min-h-screen bg-background">
      {/* Main Canvas */}
      <main className="container mx-auto px-4 py-16 max-w-4xl">
        {/* Logo and Branding */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-light text-foreground mb-2">
            Nxtscape
          </h1>
          <p className="text-muted-foreground">
            Your AI-powered browser assistant
          </p>
        </div>
        
        {/* Command Input - The Hero Element */}
        <div className="mb-12">
          <CommandInput />
        </div>
        
        {/* Quick Actions */}
        <div className="mb-12">
          <QuickActions />
        </div>
        
        {/* Pinned Agents */}
        {pinnedAgents.length > 0 && (
          <section className="mb-12">
            <h2 className="text-lg font-semibold mb-4 text-foreground">
              Pinned Agents
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {pinnedAgents.map(agent => (
                <AgentCard key={agent.id} agent={agent} />
              ))}
            </div>
          </section>
        )}
        
        {/* Recent Activity Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Recent Agents */}
          <section>
            <h2 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wider">
              Recent Agents
            </h2>
            <div className="space-y-2">
              {recentAgents.slice(0, 3).map(agent => (
                <AgentCard key={agent.id} agent={agent} variant="compact" />
              ))}
            </div>
          </section>
          
          {/* Recent Tasks */}
          <section>
            <h2 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wider">
              Recent Tasks
            </h2>
            <RecentsList type="tasks" />
          </section>
          
          {/* Recent Tabs */}
          <section>
            <h2 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wider">
              Recent Tabs
            </h2>
            <RecentsList type="tabs" />
          </section>
        </div>
      </main>
      
      {/* Keyboard Shortcuts Hint */}
      <div className="fixed bottom-4 right-4 text-xs text-muted-foreground">
        Press <kbd className="px-1 py-0.5 bg-muted rounded">?</kbd> for help
      </div>
    </div>
  )
}