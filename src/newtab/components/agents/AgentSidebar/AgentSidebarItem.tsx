import React from 'react'
import { Trash2 } from 'lucide-react'
import { type Agent } from '@/newtab/schemas/agent.schema'

interface AgentSidebarItemProps {
  agent: Agent
  isActive: boolean
  onClick: () => void
  onDelete: (e: React.MouseEvent) => void
}

export function AgentSidebarItem ({ agent, isActive, onClick, onDelete }: AgentSidebarItemProps) {
  return (
    <div 
      className={`group px-3 py-2 rounded cursor-pointer ${
        isActive ? 'bg-accent' : 'hover:bg-accent'
      }`} 
      onClick={onClick}
    >
      <div className='flex items-center justify-between'>
        <span className='text-sm'>{agent.name}</span>
        <button 
          className='opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-background' 
          aria-label='Delete' 
          onClick={onDelete}
        >
          <Trash2 className='w-4 h-4 text-muted-foreground' />
        </button>
      </div>
    </div>
  )
}