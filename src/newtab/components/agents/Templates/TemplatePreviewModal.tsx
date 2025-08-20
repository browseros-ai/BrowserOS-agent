import React from 'react'
import { X } from 'lucide-react'
import { type Template } from '@/newtab/schemas/template.schema'

interface TemplatePreviewModalProps {
  template: Template
  onClose: () => void
  onUse: (template: Template) => void
}

export function TemplatePreviewModal ({ template, onClose, onUse }: TemplatePreviewModalProps) {
  return (
    <div 
      className='fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm' 
      onClick={onClose}
    >
      <div 
        className='bg-white rounded-xl shadow-2xl max-w-3xl w-full mx-6 max-h-[85vh] overflow-hidden' 
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Content */}
        <div className='px-10 py-10 overflow-y-auto max-h-[calc(85vh-80px)]'>
          {/* Title */}
          <h1 className='text-[32px] font-semibold tracking-tight mb-2'>{template.name}</h1>
          {template.description && (
            <p className='text-[15px] text-gray-600 mb-6'>{template.description}</p>
          )}
          
          {/* Use Agent Button */}
          <button 
            onClick={() => onUse(template)}
            className='mb-8 px-3 py-1.5 text-sm rounded-md text-white bg-[hsl(var(--brand))] hover:bg-[hsl(var(--brand)/0.9)] transition-colors'
          >
            Use agent
          </button>
          
          {/* Goal Section */}
          <div className='mb-8'>
            <div className='mb-3'>
              <span className='inline-block text-[11px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 font-medium'>
                Goal:
              </span>
            </div>
            <p className='text-[15px] leading-relaxed text-gray-800'>{template.goal}</p>
          </div>
          
          {/* Steps Section */}
          <div className='mb-8'>
            <div className='mb-3'>
              <span className='inline-block text-[11px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 font-medium'>
                Steps: <span className='text-gray-500 font-normal ml-1'>
                  {template.steps.length} step{template.steps.length === 1 ? '' : 's'}
                </span>
              </span>
            </div>
            <ol className='space-y-2.5'>
              {template.steps.map((step, i) => (
                <li key={i} className='flex gap-3'>
                  <span className='text-[15px] text-gray-500 select-none'>{i + 1}.</span>
                  <p className='text-[15px] leading-relaxed text-gray-800 flex-1'>{step}</p>
                </li>
              ))}
            </ol>
          </div>
          
          {/* Notes Section */}
          {template.notes && template.notes.length > 0 && (
            <div>
              <div className='mb-3'>
                <span className='inline-block text-[11px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 font-medium'>
                  Notes:
                </span>
              </div>
              <ul className='space-y-2'>
                {template.notes.map((note, i) => (
                  <li key={i} className='flex gap-3'>
                    <span className='text-gray-500 select-none'>•</span>
                    <p className='text-[15px] leading-relaxed text-gray-800 flex-1'>{note}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        
        {/* Close button */}
        <button 
          onClick={onClose}
          className='absolute top-6 right-6 p-1.5 rounded-lg hover:bg-gray-100 transition-colors'
          aria-label='Close'
        >
          <X className='w-5 h-5 text-gray-500' />
        </button>
      </div>
    </div>
  )
}