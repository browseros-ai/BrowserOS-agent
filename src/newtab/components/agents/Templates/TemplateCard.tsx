import React from 'react'
import { type Template } from '@/newtab/schemas/template.schema'

interface TemplateCardProps {
  template: Template
  onPreview: (template: Template) => void
  onUse: (template: Template) => void
}

export function TemplateCard ({ template, onPreview, onUse }: TemplateCardProps) {
  return (
    <div 
      className='rounded border border-border bg-card p-3.5 hover:shadow-sm hover:-translate-y-[1px] transition will-change-transform flex h-[120px] flex-col cursor-pointer'
      onClick={() => onPreview(template)}
    >
      <div className='text-[16px] font-semibold mb-1'>{template.name}</div>
      <div className='text-[14px] text-muted-foreground truncate flex-1'>
        {template.description}
      </div>
      <div className='mt-2 flex items-center justify-between'>
        <span className='text-xs text-muted-foreground px-1.5 py-1 rounded border'>
          {template.steps.length} steps
        </span>
        <button
          className='px-2.5 py-1 text-xs rounded border border-[hsl(var(--brand))] text-[hsl(var(--brand))] hover:bg-[hsl(var(--brand)/0.08)]'
          onClick={(e) => {
            e.stopPropagation()
            onUse(template)
          }}
        >
          use
        </button>
      </div>
    </div>
  )
}