import React, { useMemo } from 'react'
import { Play, Edit } from 'lucide-react'
import { type Agent } from '@/newtab/schemas/agent.schema'
import { useAgentsStore } from '@/newtab/stores/agentsStore'
import { useProviderStore } from '@/newtab/stores/providerStore'

interface UserAgentsSectionProps {
  onEditAgent: () => void
}

const MAX_AGENTS_TO_SHOW = 4

export function UserAgentsSection({ onEditAgent }: UserAgentsSectionProps) {
  const { agents } = useAgentsStore()
  const { executeAgent } = useProviderStore()
  
  // Randomize and limit agents shown
  const displayedAgents = useMemo(() => {
    if (agents.length === 0) return []
    
    // Prioritize pinned agents, then shuffle the rest
    const pinned = agents.filter(a => a.isPinned)
    const unpinned = agents.filter(a => !a.isPinned)
    
    // Shuffle unpinned agents
    const shuffledUnpinned = [...unpinned].sort(() => Math.random() - 0.5)
    
    // Combine pinned (priority) with shuffled unpinned
    const combined = [...pinned, ...shuffledUnpinned]
    
    // Return up to MAX_AGENTS_TO_SHOW
    return combined.slice(0, MAX_AGENTS_TO_SHOW)
  }, [agents])
  
  // Don't render if no agents
  if (displayedAgents.length === 0) return null
  
  const handleRun = async (agent: Agent) => {
    await executeAgent(agent, agent.goal)
  }
  
  return (
    <div className="w-full max-w-3xl px-4 mt-16 animate-in fade-in duration-500">
      <div className="flex items-center justify-between mb-3 px-1">
        <h2 className="text-xs font-medium text-muted-foreground/80 uppercase tracking-wider">Your agents</h2>
        {agents.length > MAX_AGENTS_TO_SHOW && (
          <button
            onClick={onEditAgent}
            className="text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors"
          >
            View all ({agents.length})
          </button>
        )}
      </div>
      
      <div className="grid grid-cols-2 gap-2.5">
        {displayedAgents.map((agent) => (
          <button
            key={agent.id}
            onClick={() => handleRun(agent)}
            className="group relative rounded-lg border border-border/30 bg-background/40 backdrop-blur-sm p-3.5 hover:bg-background/60 hover:border-border/60 transition-all duration-200 text-left cursor-pointer"
          >
            {/* Pinned indicator */}
            {agent.isPinned && (
              <div className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-brand/60" />
            )}
            
            {/* Content */}
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-sm text-foreground/90 truncate mb-0.5 group-hover:text-foreground transition-colors">
                  {agent.name}
                </h3>
                <p className="text-xs text-muted-foreground/70 line-clamp-2 leading-relaxed">
                  {agent.description || agent.goal}
                </p>
                <div className="mt-2 flex items-center gap-3">
                  <span className="text-[10px] text-muted-foreground/50 uppercase tracking-wider">
                    {agent.steps.length} step{agent.steps.length === 1 ? '' : 's'}
                  </span>
                  <span className="text-[10px] text-brand/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                    <Play className="w-2.5 h-2.5" />
                    Run
                  </span>
                </div>
              </div>
              
              {/* Edit button - visible on hover */}
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onEditAgent()
                }}
                className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-accent transition-all ml-2 mt-0.5"
                aria-label={`Edit ${agent.name}`}
                title="Edit agent"
              >
                <Edit className="w-3 h-3 text-muted-foreground" />
              </button>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}