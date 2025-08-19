import React from 'react'
import { ListEditor } from '../shared/ListEditor'

interface StepsSectionProps {
  steps: string[]
  onChange: (steps: string[]) => void
  errors?: string[]
}

export function StepsSection ({ steps, onChange, errors }: StepsSectionProps) {
  const filteredCount = steps.filter(s => s.trim().length > 0).length
  
  return (
    <section aria-label='Steps' className='mt-6'>
      <div className='flex items-center gap-2 mb-2'>
        <span className='inline-block text-[11px] px-1.5 py-0.5 rounded bg-accent text-muted-foreground'>
          Steps:
        </span>
        <div className='text-[11px] text-muted-foreground'>
          {filteredCount} step{filteredCount === 1 ? '' : 's'}
        </div>
      </div>
      <ListEditor
        items={steps}
        onChange={onChange}
        placeholder="Steps agent should take, be as specific as you can, e.g. 'Navigate to the url...'"
        itemPrefix='1.'
        label='Steps:'
        errors={errors}
      />
    </section>
  )
}
