import React from 'react'
import { Edit2, Trash2 } from 'lucide-react'
import { type Agent } from '@/newtab/schemas/agent.schema'

interface AgentCardProps {
  agent: Agent
  onEdit: (agent: Agent) => void
  onDelete: (id: string) => void
}

export function AgentCard ({ agent, onEdit, onDelete }: AgentCardProps) {
  return (
    <div className='rounded-lg border border-[hsl(var(--brand)/0.2)] bg-card/95 backdrop-blur-sm p-3.5 shadow-sm hover:shadow-md hover:-translate-y-[1px] transition-all will-change-transform flex h-[120px] flex-col'>
      <div className='text-[16px] font-semibold mb-1 line-clamp-1'>{agent.name}</div>
      <div className='text-[14px] text-muted-foreground truncate flex-1'>
        {agent.description || 'No description'}
      </div>
      <div className='mt-2 flex items-center justify-between'>
        <span className='text-xs text-[hsl(var(--brand)/0.8)] px-1.5 py-0.5 rounded border border-[hsl(var(--brand)/0.2)] bg-[hsl(var(--brand)/0.05)]'>
          {agent.steps.length} step{agent.steps.length === 1 ? '' : 's'}
        </span>
        <div className='flex items-center gap-1'>
          <button
            className='p-1.5 rounded hover:bg-accent transition-colors'
            onClick={() => onEdit(agent)}
            aria-label='Edit agent'
          >
            <Edit2 className='w-4 h-4 text-muted-foreground' />
          </button>
          <button
            className='p-1.5 rounded hover:bg-accent transition-colors'
            onClick={() => onDelete(agent.id)}
            aria-label='Delete agent'
          >
            <Trash2 className='w-4 h-4 text-muted-foreground' />
          </button>
        </div>
      </div>
    </div>
  )
}