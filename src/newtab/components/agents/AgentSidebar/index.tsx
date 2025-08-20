import React from 'react'
import { Plus } from 'lucide-react'
import { type Agent } from '@/newtab/schemas/agent.schema'
import { AgentSidebarItem } from './AgentSidebarItem'

interface AgentSidebarProps {
  agents: Agent[]
  activeAgentId: string | null
  onSelectAgent: (agent: Agent) => void
  onDeleteAgent: (id: string) => void
  onNewAgent: () => void
}

export function AgentSidebar ({ 
  agents, 
  activeAgentId, 
  onSelectAgent, 
  onDeleteAgent, 
  onNewAgent 
}: AgentSidebarProps) {
  const handleDelete = (e: React.MouseEvent, id: string): void => {
    e.stopPropagation()
    onDeleteAgent(id)
  }

  return (
    <aside className='w-[272px] border-r border-border overflow-y-auto'>
      <div className='px-3 py-3'>
        <button 
          onClick={onNewAgent} 
          className='w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded border border-border hover:bg-accent'
        >
          <Plus className='w-4 h-4' /> New agent
        </button>
      </div>
      <div className='px-2 pb-4 space-y-1'>
        {agents.map(agent => (
          <AgentSidebarItem
            key={agent.id}
            agent={agent}
            isActive={activeAgentId === agent.id}
            onClick={() => onSelectAgent(agent)}
            onDelete={(e) => handleDelete(e, agent.id)}
          />
        ))}
      </div>
    </aside>
  )
}