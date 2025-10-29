import React from 'react'
import { Play, Save } from 'lucide-react'

interface AgentEditorHeaderProps {
  notification?: string
  canRun: boolean
  isFromTemplate?: boolean
  onRun: () => void
  onSave: () => void
}

export function AgentEditorHeader ({ notification, canRun, isFromTemplate, onRun, onSave }: AgentEditorHeaderProps) {
  return (
    <div className='flex items-center gap-3'>
      {notification && (
        <span className='text-xs text-muted-foreground'>{notification}</span>
      )}
      <button
        onClick={onRun}
        disabled={!canRun}
        className='px-3 py-1.5 text-sm font-medium rounded border border-[hsl(var(--brand))] text-[hsl(var(--brand))] hover:bg-[hsl(var(--brand))] hover:text-white disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-[hsl(var(--brand))] transition-colors flex items-center gap-1.5'
      >
        <Play className='w-3.5 h-3.5' />
        Run Now
      </button>
      <button 
        onClick={onSave} 
        className='px-3 py-1.5 text-sm rounded border border-border hover:bg-accent transition-colors'
      >
        <Save className='w-4 h-4 inline mr-1' /> {isFromTemplate ? 'Copy this template' : 'Save'}
      </button>
    </div>
  )
}