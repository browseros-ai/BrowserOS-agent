import React, { useRef, useEffect } from 'react'
import { AutoResizeTextarea } from './AutoResizeTextarea'

interface ListEditorProps {
  items: string[]
  onChange: (items: string[]) => void
  placeholder?: string
  itemPrefix?: string  // "1." for steps, "•" for notes
  label: string
  errors?: string[]
}

export function ListEditor ({ items, onChange, placeholder, itemPrefix, label, errors }: ListEditorProps) {
  const itemRefs = useRef<Array<HTMLTextAreaElement | null>>([])

  // Handle keyboard navigation and list management
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>, index: number): void => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      const current = items[index]
      if (current.trim().length === 0) return
      
      const next = [...items]
      next.splice(index + 1, 0, '')
      onChange(next)
      
      setTimeout(() => itemRefs.current[index + 1]?.focus(), 0)
      return
    }
    
    if (e.key === 'Backspace') {
      const value = items[index]
      const selectionStart = e.currentTarget.selectionStart || 0
      
      if (value.length === 0 || (value.trim().length === 0 && selectionStart === 0)) {
        if (items.length <= 1) return
        e.preventDefault()
        
        const next = items.filter((_, i) => i !== index)
        onChange(next)
        
        const focusIndex = Math.max(0, index - 1)
        setTimeout(() => {
          const target = itemRefs.current[focusIndex]
          if (target) {
            target.focus()
            target.selectionStart = target.value.length
            target.selectionEnd = target.value.length
          }
        }, 0)
      }
    }
  }

  // Update item at index
  const updateItem = (index: number, value: string): void => {
    const next = [...items]
    next[index] = value
    onChange(next)
  }

  // Generate appropriate placeholder for each item
  const getPlaceholder = (index: number): string => {
    // Use custom placeholder only for the first item
    if (placeholder && index === 0) return placeholder
    if (index === 0) {
      return label === 'Steps:' 
        ? 'When mentioned… analyze the user\'s question.'
        : 'Keep responses concise and to the point.'
    }
    return label === 'Steps:' ? 'Describe this step…' : 'Add note…'
  }

  return (
    <div className='space-y-1'>
      {items.map((text, i) => (
        <div key={i} className={itemPrefix === '•' ? 'pl-6 relative' : 'flex items-start gap-3'}>
          {itemPrefix === '•' ? (
            <span className='absolute left-0 top-1 text-muted-foreground'>•</span>
          ) : itemPrefix ? (
            <span className='mt-1.5 min-w-[20px] text-[14px] text-muted-foreground select-none'>
              {i + 1}.
            </span>
          ) : null}
          <AutoResizeTextarea
            ref={el => { itemRefs.current[i] = el }}
            value={text}
            onChange={(e) => updateItem(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(e, i)}
            placeholder={getPlaceholder(i)}
            className='w-full min-h-[28px] text-[16px] leading-7 outline-none resize-none placeholder:text-muted-foreground bg-transparent text-foreground'
          />
        </div>
      ))}
      {errors && errors.length > 0 && (
        <div className='text-xs text-red-600 mt-1'>{errors[0]}</div>
      )}
    </div>
  )
}
