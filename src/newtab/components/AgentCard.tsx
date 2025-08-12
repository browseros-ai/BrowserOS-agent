import React from 'react'
import { Agent } from '../stores/agentsStore'

interface AgentCardProps {
  agent: Agent
  variant?: 'default' | 'compact'
}

export function AgentCard({ agent, variant = 'default' }: AgentCardProps) {
  const isCompact = variant === 'compact'
  
  const handleRun = () => {
    // Execute agent
    console.log('Running agent:', agent.name)
  }
  
  if (isCompact) {
    return (
      <button
        className="
          w-full p-3 text-left
          bg-card border border-border rounded-lg
          hover:bg-accent hover:border-primary
          transition-all duration-200
          focus:ring-2 focus:ring-primary focus:outline-none
        "
        onClick={handleRun}
      >
        <div className="flex items-center justify-between">
          <span className="font-medium text-sm">{agent.name}</span>
          <span className="text-xs text-muted-foreground">Run →</span>
        </div>
      </button>
    )
  }
  
  return (
    <div className="
      p-4
      bg-card border border-border rounded-lg
      hover:border-primary hover:shadow-md
      transition-all duration-200
      cursor-pointer
    ">
      <div className="flex items-start justify-between mb-2">
        <h3 className="font-semibold text-foreground">{agent.name}</h3>
        {agent.isPinned && (
          <span className="text-xs text-primary">📌</span>
        )}
      </div>
      
      <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
        {agent.description}
      </p>
      
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {agent.tools.slice(0, 2).map(tool => (
            <span
              key={tool}
              className="px-2 py-1 bg-muted text-xs rounded"
            >
              {tool}
            </span>
          ))}
        </div>
        
        <button
          className="
            px-3 py-1
            bg-primary text-primary-foreground
            text-xs font-medium rounded
            hover:bg-primary/90
            transition-colors
          "
          onClick={handleRun}
        >
          Run
        </button>
      </div>
    </div>
  )
}