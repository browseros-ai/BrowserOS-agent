import React from 'react'
import { GoalSection } from './GoalSection'
import { StepsSection } from './StepsSection'
import { NotesSection } from './NotesSection'

interface AgentEditorFormProps {
  name: string
  description: string
  goal: string
  steps: string[]
  notes: string[]
  errors: Record<string, string>
  onNameChange: (name: string) => void
  onDescriptionChange: (desc: string) => void
  onGoalChange: (goal: string) => void
  onStepsChange: (steps: string[]) => void
  onNotesChange: (notes: string[]) => void
}

const DEFAULT_TITLE = 'Untitled agent'

export function AgentEditorForm ({
  name,
  description,
  goal,
  steps,
  notes,
  errors,
  onNameChange,
  onDescriptionChange,
  onGoalChange,
  onStepsChange,
  onNotesChange
}: AgentEditorFormProps) {
  return (
    <div className='mx-auto max-w-[820px] px-10 py-10'>
      {/* Title */}
      <input
        value={name}
        onChange={(e) => onNameChange(e.target.value)}
        placeholder={DEFAULT_TITLE}
        className='w-full text-[34px] font-semibold tracking-tight outline-none placeholder:text-muted-foreground bg-transparent text-foreground'
      />
      <input
        value={description}
        onChange={(e) => onDescriptionChange(e.target.value)}
        placeholder='Add a short description…'
        className='w-full mt-2 text-[15px] text-muted-foreground outline-none placeholder:text-muted-foreground bg-transparent'
      />

      {/* Goal */}
      <GoalSection 
        goal={goal} 
        onChange={onGoalChange} 
        error={errors.goal}
      />

      {/* Steps */}
      <StepsSection 
        steps={steps} 
        onChange={onStepsChange}
        errors={errors.steps ? [errors.steps] : undefined}
      />

      {/* Notes */}
      <NotesSection 
        notes={notes} 
        onChange={onNotesChange}
      />
    </div>
  )
}