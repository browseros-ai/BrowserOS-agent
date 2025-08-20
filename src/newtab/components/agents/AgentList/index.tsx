import React from 'react'
import { Plus } from 'lucide-react'
import { type Agent } from '@/newtab/schemas/agent.schema'
import { AgentCard } from './AgentCard'
import { EmptyState } from './EmptyState'

interface AgentListProps {
  agents: Agent[]
  onEdit: (agent: Agent) => void
  onDelete: (id: string) => void
  onNew: () => void
}

export function AgentList ({ agents, onEdit, onDelete, onNew }: AgentListProps) {
  return (
    <section className='relative -mx-4 px-4 py-4 rounded-lg bg-gradient-to-br from-[hsl(var(--brand)/0.03)] to-[hsl(var(--brand)/0.06)]'>
      <div className='flex items-center justify-between mb-3'>
        <h2 className='text-[18px] font-semibold tracking-tight'>Your agents</h2>
        <button 
          onClick={onNew} 
          className='px-3 py-1.5 text-sm rounded-md text-white bg-[hsl(var(--brand))] hover:bg-[hsl(var(--brand)/0.9)] transition-colors'
        >
          <Plus className='w-4 h-4 inline mr-1' /> New agent
        </button>
      </div>
      {agents.length === 0 ? (
        <EmptyState />
      ) : (
        <div className='grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'>
          {agents.map((agent) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </section>
  )
}