import React from 'react'
import { ListEditor } from '../shared/ListEditor'

interface NotesSectionProps {
  notes: string[]
  onChange: (notes: string[]) => void
}

export function NotesSection ({ notes, onChange }: NotesSectionProps) {
  return (
    <section aria-label='Notes' className='mt-6 mb-28'>
      <div className='mb-2'>
        <span className='inline-block text-[11px] px-1.5 py-0.5 rounded bg-accent text-muted-foreground'>
          Notes:
        </span>
      </div>
      <ListEditor
        items={notes}
        onChange={onChange}
        placeholder="Constraints/preferences, e.g. 'Don't use slang', 'Be concise'"
        itemPrefix='•'
        label='Notes:'
      />
    </section>
  )
}
