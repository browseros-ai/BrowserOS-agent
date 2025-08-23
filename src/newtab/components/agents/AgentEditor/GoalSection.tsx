import React from 'react'
import { AutoResizeTextarea } from '../shared/AutoResizeTextarea'

interface GoalSectionProps {
  goal: string
  onChange: (goal: string) => void
  error?: string
}

export function GoalSection ({ goal, onChange, error }: GoalSectionProps) {
  return (
    <section aria-label='Goal' className='mt-6'>
      <div className='mb-2'>
        <span className='inline-block text-[11px] px-1.5 py-0.5 rounded bg-accent text-muted-foreground'>
          Goal:
        </span>
      </div>
      <AutoResizeTextarea
        value={goal}
        onChange={(e) => onChange(e.target.value)}
        placeholder="One line description of the agent's goal, e.g. 'Help me summarise my emails'"
        minRows={1}
        className={`w-full min-h-[28px] text-[16px] leading-7 outline-none resize-none placeholder:text-muted-foreground bg-transparent text-foreground ${
          error ? 'ring-1 ring-red-500/60 rounded' : ''
        }`}
      />
      {error && <div className='text-xs text-red-600 mt-1'>{error}</div>}
    </section>
  )
}
